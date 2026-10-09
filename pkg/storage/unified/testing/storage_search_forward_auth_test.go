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
	"uuid"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/grpcutils"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func TestStorageSearchForwardAuth(t *testing.T) {
	const namespace = "stacks-1"
	const permission = "dashboard.grafana.app/dashboards:get"

	// Both dashboards match the query, so excluding one must come from authorization.
	backend := setupBadgerKV(t)
	for _, folder := range []string{"allowed", "denied"} {
		obj := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "dashboard.grafana.app/v1",
			"kind":       "Dashboard",
			"metadata": map[string]any{
				"name":      folder,
				"namespace": namespace,
			},
			"spec": map[string]any{"title": "Matching dashboard"},
		}}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetFolder(folder)
		value, err := obj.MarshalJSON()
		require.NoError(t, err)
		_, err = backend.WriteEvent(t.Context(), resource.WriteEvent{
			Type: resourcepb.WatchEvent_ADDED,
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     searchBackedTrashGroup,
				Resource:  searchBackedTrashResource,
				Name:      folder,
			},
			Value:  value,
			Object: meta,
			GUID:   uuid.NewV4().String(),
		})
		require.NoError(t, err)
	}
	index, err := search.NewBleveBackend(search.BleveOptions{Root: t.TempDir()}, nil)
	require.NoError(t, err)
	t.Cleanup(index.Stop)
	// Keep the production service-permission guard in front of the test's folder policy.
	// This exercises both delegated grants and filtering of individual search hits.
	server, err := newResourceServerWithSearch(resource.ResourceServerOptions{
		Backend: backend,
		AccessClient: resource.NewAuthzLimitedClient(denyFolderAccess{denied: "denied"}, resource.AuthzOptions{
			Registry: prometheus.NewRegistry(),
		}),
	}, resource.SearchOptions{
		Backend:   index,
		Resources: labelFolderBuilderSupplier{},
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		require.NoError(t, server.Stop(ctx))
	})

	// Storage and search trust the same signing key and audience, as forwarding requires.
	// Serve the public key through JWKS so both use the production token verifiers.
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	jwks, err := json.Marshal(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{
		Key:       &key.PublicKey,
		KeyID:     "forward-auth-test",
		Algorithm: string(jose.ES256),
		Use:       "sig",
	}}})
	require.NoError(t, err)
	keys := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(jwks)
	}))
	t.Cleanup(keys.Close)
	tracer := otel.Tracer("storage-search-forward-auth-test")
	authConfig := &grpcutils.AuthenticatorConfig{
		SigningKeysURL:   keys.URL,
		AllowedAudiences: []string{"resourceStore"},
	}
	storageAuth := grpcutils.NewAuthenticator(authConfig, tracer)
	searchAuth := grpcutils.NewAuthenticator(authConfig, tracer)
	// Capture the identity only after search has authenticated the forwarded credentials.
	received := make(chan types.AuthInfo, 1)
	grpcServer := grpc.NewServer(grpc.ChainUnaryInterceptor(
		grpcAuth.UnaryServerInterceptor(searchAuth),
		func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
			info, _ := types.AuthInfoFrom(ctx)
			received <- info
			return handler(ctx, req)
		},
	))
	resourcepb.RegisterResourceIndexServer(grpcServer, server.SearchHandler())
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	go func() { _ = grpcServer.Serve(listener) }()
	t.Cleanup(grpcServer.Stop)

	// Configure storage's internal search client without any token-exchange credentials.
	cfg := setting.NewCfg()
	cfg.Env = "production"
	cfg.EnableSearchClient = true
	cfg.SearchClientForwardAuthEnabled = true
	cfg.Raw.Section("grafana-apiserver").Key("search_server_address").SetValue(listener.Addr().String())
	client, err := unified.NewStorageApiSearchClient(cfg, featuremgmt.WithFeatures(featuremgmt.FlagAppPlatformGrpcClientAuth))
	require.NoError(t, err)
	request := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     searchBackedTrashGroup,
				Resource:  searchBackedTrashResource,
			},
		},
		Query: "Matching",
		Limit: 10,
	}
	sign := func(signingKey *ecdsa.PrivateKey, tokenType string, claims any) string {
		signer, err := jose.NewSigner(jose.SigningKey{
			Algorithm: jose.ES256,
			Key:       signingKey,
		}, &jose.SignerOptions{
			ExtraHeaders: map[jose.HeaderKey]any{
				"typ": tokenType,
				"kid": "forward-auth-test",
			},
		})
		require.NoError(t, err)
		token, err := jwt.Signed(signer).Claims(claims).Serialize()
		require.NoError(t, err)
		return token
	}
	common := jwt.Claims{
		Issuer:   "grafana",
		Subject:  "access-policy:caller",
		Audience: jwt.Audience{"resourceStore"},
		IssuedAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
		Expiry:   jwt.NewNumericDate(time.Now().Add(time.Hour)),
	}
	user := authn.IDTokenClaims{
		Type:       types.TypeUser,
		Identifier: "1",
		Namespace:  namespace,
	}
	// Cover separate access/ID tokens and OBO's embedded user, with and without delegation.
	for _, mode := range []string{"classic", "obo"} {
		t.Run(mode, func(t *testing.T) {
			for _, delegated := range []bool{true, false} {
				name := "missing delegation"
				if delegated {
					name = "authorized results only"
				}
				t.Run(name, func(t *testing.T) {
					// Ordinary service permissions cannot substitute for delegated grants on user calls.
					accessClaims := authn.Claims[authn.AccessTokenClaims]{
						Claims: common,
						Rest: authn.AccessTokenClaims{
							Namespace:   namespace,
							Permissions: []string{permission},
						},
					}
					if delegated {
						accessClaims.Rest.DelegatedPermissions = []string{permission}
					}
					md := metadata.MD{}
					if mode == "obo" {
						accessClaims.Rest.Actor = &authn.ActorClaims{
							Subject:       "user:1",
							IDTokenClaims: user,
						}
					} else {
						idClaims := authn.Claims[authn.IDTokenClaims]{
							Claims: common,
							Rest:   user,
						}
						idClaims.Subject = "user:1"
						md.Set("x-id-token", sign(key, authn.TokenTypeID, idClaims))
					}
					md.Set("x-access-token", sign(key, authn.TokenTypeAccess, accessClaims))
					// Authenticate the incoming request at storage, then forward its verified tokens
					// over gRPC for search to authenticate independently.
					ctx, err := storageAuth(metadata.NewIncomingContext(t.Context(), md))
					require.NoError(t, err)
					resp, err := client.Search(ctx, request)
					require.NoError(t, err)
					require.NotNil(t, resp)
					// Forwarding must preserve the user, tenant, and exact original token bytes.
					info := <-received
					require.Equal(t, types.TypeUser, info.GetIdentityType())
					require.Equal(t, "user:1", info.GetUID())
					require.Equal(t, namespace, info.GetNamespace())
					require.Equal(t, md.Get("x-access-token")[0], info.GetAccessToken())
					if mode == "classic" {
						require.Equal(t, md.Get("x-id-token")[0], info.GetIDToken())
					} else {
						require.Empty(t, info.GetIDToken())
					}
					if !delegated {
						// Missing delegation is an explicit failure, not a successful empty search.
						require.NotNil(t, resp.Error)
						require.Contains(t, resp.Error.Message, resource.ErrServiceCannotDelegate.Error())
						require.Contains(t, resp.Error.Message, permission)
						require.Empty(t, resp.Results.GetRows())
						return
					}
					// A valid delegated grant permits the search but does not grant access to every hit.
					require.Equal(t, []string{permission}, info.GetTokenDelegatedPermissions())
					require.Nil(t, resp.Error)
					require.Equal(t, int64(1), resp.TotalHits)
					require.Len(t, resp.Results.Rows, 1)
					require.Equal(t, "allowed", resp.Results.Rows[0].Key.Name)
				})
			}
		})
	}

	t.Run("search rejects an invalid signature", func(t *testing.T) {
		otherKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		require.NoError(t, err)
		token := sign(otherKey, authn.TokenTypeAccess, authn.Claims[authn.AccessTokenClaims]{
			Claims: common,
			Rest: authn.AccessTokenClaims{
				Namespace:            namespace,
				Permissions:          []string{permission},
				DelegatedPermissions: []string{permission},
				Actor: &authn.ActorClaims{
					Subject:       "user:1",
					IDTokenClaims: user,
				},
			},
		})
		// Bypass storage authentication here to prove search itself rejects an untrusted signature.
		ctx := types.WithAuthInfo(t.Context(), &identity.StaticRequester{AccessToken: token})
		resp, err := client.Search(ctx, request)
		require.ErrorContains(t, err, jose.ErrCryptoFailure.Error())
		require.Nil(t, resp)
		require.Empty(t, received)
	})
}
