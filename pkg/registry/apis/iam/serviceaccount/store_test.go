package serviceaccount

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

type serviceAccountStoreFake struct {
	legacy.LegacyIdentityStore
	listResult *legacy.ListServiceAccountResult
	updateErr  error
	updated    legacy.UpdateServiceAccountCommand
}

func (f *serviceAccountStoreFake) ListServiceAccounts(context.Context, claims.NamespaceInfo, legacy.ListServiceAccountsQuery) (*legacy.ListServiceAccountResult, error) {
	return f.listResult, nil
}

func (f *serviceAccountStoreFake) UpdateServiceAccount(_ context.Context, _ claims.NamespaceInfo, cmd legacy.UpdateServiceAccountCommand) (*legacy.UpdateServiceAccountResult, error) {
	f.updated = cmd
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	return &legacy.UpdateServiceAccountResult{ServiceAccount: legacy.ServiceAccount{
		ID:       1,
		UID:      cmd.UID,
		Name:     cmd.Name,
		Disabled: cmd.IsDisabled,
		Role:     cmd.Role,
		Created:  time.Unix(1, 0).UTC(),
		Updated:  time.Unix(2, 0).UTC(),
	}}, nil
}

func TestLegacyStoreUpdate(t *testing.T) {
	newObject := func() *iamv0alpha1.ServiceAccount {
		return &iamv0alpha1.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{Name: "sa-uid", Namespace: "default", ResourceVersion: "1000"},
			Spec: iamv0alpha1.ServiceAccountSpec{
				Title:    "Updated service account",
				Role:     iamv0alpha1.ServiceAccountOrgRoleEditor,
				Disabled: true,
			},
		}
	}
	old := legacy.ServiceAccount{
		ID:      1,
		UID:     "sa-uid",
		Name:    "Service account",
		Role:    string(iamv0alpha1.ServiceAccountOrgRoleViewer),
		Created: time.Unix(1, 0).UTC(),
		Updated: time.Unix(1, 0).UTC(),
	}
	ctx := genericapirequest.WithNamespace(context.Background(), "default")

	t.Run("updates the mutable fields", func(t *testing.T) {
		fake := &serviceAccountStoreFake{listResult: &legacy.ListServiceAccountResult{Items: []legacy.ServiceAccount{old}}}
		store := NewLegacyStore(fake, nil, noop.NewTracerProvider().Tracer("test"))

		result, created, err := store.Update(ctx, "sa-uid", rest.DefaultUpdatedObjectInfo(newObject()), nil, nil, false, &metav1.UpdateOptions{})

		require.NoError(t, err)
		require.False(t, created)
		require.Equal(t, legacy.UpdateServiceAccountCommand{
			UID:        "sa-uid",
			Name:       "Updated service account",
			Role:       string(iamv0alpha1.ServiceAccountOrgRoleEditor),
			IsDisabled: true,
		}, fake.updated)
		updated, ok := result.(*iamv0alpha1.ServiceAccount)
		require.True(t, ok)
		require.Equal(t, newObject().Spec, updated.Spec)
	})

	t.Run("maps a disappeared service account to not found", func(t *testing.T) {
		fake := &serviceAccountStoreFake{
			listResult: &legacy.ListServiceAccountResult{Items: []legacy.ServiceAccount{old}},
			updateErr:  serviceaccounts.ErrServiceAccountNotFound.Errorf("missing"),
		}
		store := NewLegacyStore(fake, nil, noop.NewTracerProvider().Tracer("test"))

		_, _, err := store.Update(ctx, "sa-uid", rest.DefaultUpdatedObjectInfo(newObject()), nil, nil, false, &metav1.UpdateOptions{})

		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err))
	})
}
