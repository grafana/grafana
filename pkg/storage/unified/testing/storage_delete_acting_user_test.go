package test

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// TestDeleteActingUserOverGRPC sends DeleteRequest through a real gRPC connection, so the field is
// serialized on the wire and the caller is authenticated from signed tokens by the production
// authenticator, as on the remote storage path.
func TestDeleteActingUserOverGRPC(t *testing.T) {
	const (
		namespace = "stacks-1"
		actingUID = "user:acting"
		policyUID = "access-policy:grafana"
	)

	backend := setupBadgerKV(t)
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      backend,
		AccessClient: types.FixedAccessClient(true),
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		require.NoError(t, server.Stop(ctx))
	})

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	jwks, err := json.Marshal(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{
		Key: &key.PublicKey, KeyID: "delete-acting-user-test", Algorithm: string(jose.ES256), Use: "sig",
	}}})
	require.NoError(t, err)
	keys := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(jwks)
	}))
	t.Cleanup(keys.Close)

	auth := grpcutils.NewAuthenticator(&grpcutils.AuthenticatorConfig{
		SigningKeysURL:   keys.URL,
		AllowedAudiences: []string{"resourceStore"},
	}, otel.Tracer("delete-acting-user-test"))
	grpcServer := grpc.NewServer(grpc.UnaryInterceptor(grpcAuth.UnaryServerInterceptor(auth)))
	resourcepb.RegisterResourceStoreServer(grpcServer, server)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	go func() { _ = grpcServer.Serve(listener) }()
	t.Cleanup(grpcServer.Stop)

	conn, err := grpc.NewClient(listener.Addr().String(), grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	client := resourcepb.NewResourceStoreClient(conn)

	sign := func(tokenType string, claims any) string {
		signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, &jose.SignerOptions{
			ExtraHeaders: map[jose.HeaderKey]any{"typ": tokenType, "kid": "delete-acting-user-test"},
		})
		require.NoError(t, err)
		token, err := jwt.Signed(signer).Claims(claims).Serialize()
		require.NoError(t, err)
		return token
	}
	common := func(subject string) jwt.Claims {
		return jwt.Claims{
			Issuer:   "grafana",
			Subject:  subject,
			Audience: jwt.Audience{"resourceStore"},
			IssuedAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
			Expiry:   jwt.NewNumericDate(time.Now().Add(time.Hour)),
		}
	}
	accessToken := sign(authn.TokenTypeAccess, authn.Claims[authn.AccessTokenClaims]{
		Claims: common(policyUID),
		Rest:   authn.AccessTokenClaims{Namespace: namespace},
	})
	// A user request carries the user's ID token next to the service's access token, so the
	// server authenticates the caller as that user.
	idToken := sign(authn.TokenTypeID, authn.Claims[authn.IDTokenClaims]{
		Claims: common("user:1"),
		Rest:   authn.IDTokenClaims{Type: types.TypeUser, Identifier: "1", Namespace: namespace},
	})

	callers := map[string]metadata.MD{
		"access policy": metadata.Pairs("x-access-token", accessToken),
		"user":          metadata.Pairs("x-access-token", accessToken, "x-id-token", idToken),
	}

	// deleteAs creates and deletes a resource over gRPC as the given caller and returns the
	// updatedBy stored on the deletion marker.
	deleteAs := func(t *testing.T, name string, md metadata.MD, actingUser string) string {
		t.Helper()
		ctx := metadata.NewOutgoingContext(t.Context(), md)
		rkey := &resourcepb.ResourceKey{Group: "folder.grafana.app", Resource: "folders", Namespace: namespace, Name: name}
		value, err := (&unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "folder.grafana.app/v1",
			"kind":       "Folder",
			"metadata":   map[string]any{"name": name, "namespace": namespace},
			"spec":       map[string]any{"title": name},
		}}).MarshalJSON()
		require.NoError(t, err)

		created, err := client.Create(ctx, &resourcepb.CreateRequest{Key: rkey, Value: value})
		require.NoError(t, err)
		deleted, err := client.Delete(ctx, &resourcepb.DeleteRequest{
			Key: rkey, ResourceVersion: created.ResourceVersion, ActingUserUid: actingUser,
		})
		require.NoError(t, err)

		// The deletion marker is only visible through the trash listing.
		var markerValue []byte
		_, err = backend.ListHistory(t.Context(), &resourcepb.ListRequest{
			Source:  resourcepb.ListRequest_TRASH,
			Options: &resourcepb.ListOptions{Key: rkey},
		}, func(it resource.ListIterator) error {
			for it.Next() {
				if it.ResourceVersion() == deleted.ResourceVersion {
					markerValue = append([]byte(nil), it.Value()...)
				}
			}
			return it.Error()
		})
		require.NoError(t, err)
		require.NotEmpty(t, markerValue)
		obj := &unstructured.Unstructured{}
		require.NoError(t, json.Unmarshal(markerValue, obj))
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		require.NotNil(t, meta.GetDeletionTimestamp())
		return meta.GetUpdatedBy()
	}

	t.Run("acting user survives serialization for an access policy", func(t *testing.T) {
		require.Equal(t, actingUID, deleteAs(t, "as-policy", callers["access policy"], actingUID))
	})

	t.Run("access policy without an acting user records itself", func(t *testing.T) {
		require.Equal(t, policyUID, deleteAs(t, "policy-self", callers["access policy"], ""))
	})

	t.Run("user cannot choose the recorded deleter", func(t *testing.T) {
		require.Equal(t, "user:1", deleteAs(t, "as-user", callers["user"], actingUID))
	})
}
