package resource

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestDeleteActingUser(t *testing.T) {
	const (
		namespace = "default"
		actingUID = "user:acting"
	)
	key := &resourcepb.ResourceKey{Group: "folder.grafana.app", Resource: "folders", Namespace: namespace, Name: "f1"}
	value := []byte(`{"apiVersion":"folder.grafana.app/v1","kind":"Folder","metadata":{"name":"f1","namespace":"default"},"spec":{"title":"F1"}}`)

	// Callers are built the way the server's authenticator builds them from tokens, so the test
	// covers the identity the server sees on the wire rather than an in-context service identity.
	const servicePolicy = "access-policy:grafana"
	accessToken := authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: servicePolicy},
		Rest:   authn.AccessTokenClaims{Namespace: "*"},
	}
	serviceCtx := authlib.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(accessToken))
	// A user request carries an ID token, so the caller authenticates as the user even when the
	// access token belongs to a service.
	userInfo := authn.NewIDTokenAuthInfo(accessToken, &authn.Claims[authn.IDTokenClaims]{
		Claims: jwt.Claims{Subject: "user:u123"},
		Rest:   authn.IDTokenClaims{Type: authlib.TypeUser, Identifier: "u123", Namespace: namespace},
	})
	userCtx := authlib.WithAuthInfo(context.Background(), userInfo)
	staticUser := &identity.StaticRequester{Type: authlib.TypeUser, UserID: 123, UserUID: "u123", OrgRole: identity.RoleAdmin, Namespace: namespace}
	staticUserCtx := authlib.WithAuthInfo(context.Background(), staticUser)

	// deleteAs creates the object, deletes it as the caller in ctx with the given acting user, and
	// returns the updatedBy recorded on the deletion marker.
	deleteAs := func(t *testing.T, ctx context.Context, actingUser string) string {
		t.Helper()
		db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
		require.NoError(t, err)
		t.Cleanup(func() { _ = db.Close() })
		backend, err := NewKVStorageBackend(KVBackendOptions{KvStore: NewBadgerKV(db)})
		require.NoError(t, err)

		srv, err := NewResourceServer(ResourceServerOptions{
			Backend:      backend,
			AccessClient: authlib.FixedAccessClient(true),
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = srv.Stop(stopCtx)
		})

		var markerValue []byte
		created, err := srv.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: value})
		require.NoError(t, err)

		deleted, err := srv.Delete(ctx, &resourcepb.DeleteRequest{Key: key, ResourceVersion: created.ResourceVersion, ActingUserUid: actingUser})
		require.NoError(t, err)

		// The deletion marker is only visible through the trash listing.
		trash, err := backend.ListHistory(ctx, &resourcepb.ListRequest{
			Source:  resourcepb.ListRequest_TRASH,
			Options: &resourcepb.ListOptions{Key: key},
		}, func(it ListIterator) error {
			for it.Next() {
				if it.ResourceVersion() == deleted.ResourceVersion {
					markerValue = append([]byte(nil), it.Value()...)
				}
			}
			return it.Error()
		})
		require.NoError(t, err)
		require.Positive(t, trash)
		require.NotEmpty(t, markerValue)
		obj := &unstructured.Unstructured{}
		require.NoError(t, json.Unmarshal(markerValue, obj))
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		require.NotNil(t, meta.GetDeletionTimestamp())
		return meta.GetUpdatedBy()
	}

	t.Run("access policy records the acting user as the deleter", func(t *testing.T) {
		require.Equal(t, actingUID, deleteAs(t, serviceCtx, actingUID))
	})

	t.Run("access policy without an acting user records itself", func(t *testing.T) {
		require.Equal(t, servicePolicy, deleteAs(t, serviceCtx, ""))
	})

	t.Run("regular user cannot choose the recorded deleter", func(t *testing.T) {
		require.Equal(t, userInfo.GetUID(), deleteAs(t, userCtx, actingUID))
		require.Equal(t, staticUser.GetUID(), deleteAs(t, staticUserCtx, actingUID))
	})
}
