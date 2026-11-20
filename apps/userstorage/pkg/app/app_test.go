package app

import (
	"context"
	"testing"

	authtypes "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/userstorage/pkg/apis/userstorage/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestValidateUserStorage(t *testing.T) {
	named := func(name string) *v0alpha1.UserStorage {
		return &v0alpha1.UserStorage{ObjectMeta: metav1.ObjectMeta{Name: name}}
	}
	tests := []struct {
		name    string
		action  resource.AdmissionAction
		obj     string
		userUID string
		wantErr bool
	}{
		{"create own", resource.AdmissionActionCreate, "svc:abc", "user:abc", false},
		{"create for another user", resource.AdmissionActionCreate, "svc:xyz", "user:abc", true},
		{"create without a user in the name", resource.AdmissionActionCreate, "svc", "user:abc", true},
		{"create with extra parts", resource.AdmissionActionCreate, "svc:abc:x", "user:abc", true},
		{"create with an untyped caller uid", resource.AdmissionActionCreate, "svc:abc", "abc", true},
		{"update is not checked", resource.AdmissionActionUpdate, "svc:xyz", "user:abc", false},
	}
	t.Run("caller from the request context", func(t *testing.T) {
		ctx := authtypes.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "abc"})
		req := func(name string) *app.AdmissionRequest {
			// The router sends no user info, only the caller's token.
			return &app.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: named(name)}
		}
		require.NoError(t, validateUserStorage(ctx, req("svc:abc")))
		require.Error(t, validateUserStorage(ctx, req("svc:xyz")))
	})

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateUserStorage(context.Background(), &app.AdmissionRequest{
				Action:   tt.action,
				Object:   named(tt.obj),
				UserInfo: resource.AdmissionUserInfo{UID: tt.userUID},
			})
			if tt.wantErr {
				require.True(t, apierrors.IsInvalid(err), "want an invalid error, got %v", err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
