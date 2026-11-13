package legacyannotations

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	authtypes "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// dashboardLike derives more from columns than a data source does, which is the
// whole reason the derived set is per-resource.
var dashboardLike = NewPolicy(utils.AnnoKeyUpdatedTimestamp, utils.AnnoKeyFolder, utils.AnnoKeyMessage)

func TestPolicyToStore(t *testing.T) {
	tests := []struct {
		name        string
		annotations map[string]string
		want        map[string]string
	}{
		{
			name: "keeps manager and source properties",
			annotations: map[string]string{
				utils.AnnoKeyManagerKind:     "repo",
				utils.AnnoKeyManagerIdentity: "my-repo",
				utils.AnnoKeySourcePath:      "dashboards/a.json",
			},
			want: map[string]string{
				utils.AnnoKeyManagerKind:     "repo",
				utils.AnnoKeyManagerIdentity: "my-repo",
				utils.AnnoKeySourcePath:      "dashboards/a.json",
			},
		},
		{
			name: "drops every derived annotation",
			annotations: map[string]string{
				utils.AnnoKeyUpdatedTimestamp: "2026-01-01T00:00:00Z",
				utils.AnnoKeyFolder:           "some-folder",
				utils.AnnoKeyMessage:          "a commit message",
				utils.AnnoKeyManagerKind:      "repo",
			},
			want: map[string]string{utils.AnnoKeyManagerKind: "repo"},
		},
		{
			name:        "keeps an annotation the policy has never heard of",
			annotations: map[string]string{"example.com/thing": "value"},
			want:        map[string]string{"example.com/thing": "value"},
		},
		{
			name:        "nil rather than an empty map when only derived keys are present",
			annotations: map[string]string{utils.AnnoKeyFolder: "some-folder"},
		},
		{
			name: "nil for an object with no annotations",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			obj := &metav1.ObjectMeta{Annotations: tt.annotations}
			require.Equal(t, tt.want, dashboardLike.ToStore(obj))
		})
	}
}

func TestPolicyApply(t *testing.T) {
	t.Run("a stored copy never wins over the column it mirrors", func(t *testing.T) {
		obj := &metav1.ObjectMeta{Annotations: map[string]string{
			utils.AnnoKeyUpdatedTimestamp: "from-the-column",
			utils.AnnoKeyFolder:           "from-the-column",
		}}

		dashboardLike.Apply(obj, map[string]string{
			utils.AnnoKeyUpdatedTimestamp: "stale",
			utils.AnnoKeyFolder:           "stale",
			utils.AnnoKeyManagerKind:      "repo",
		})

		require.Equal(t, map[string]string{
			utils.AnnoKeyUpdatedTimestamp: "from-the-column",
			utils.AnnoKeyFolder:           "from-the-column",
			utils.AnnoKeyManagerKind:      "repo",
		}, obj.Annotations)
	})

	t.Run("nothing stored leaves the object alone", func(t *testing.T) {
		obj := &metav1.ObjectMeta{}
		dashboardLike.Apply(obj, nil)
		require.Nil(t, obj.Annotations)
	})

	t.Run("round trips through ToStore", func(t *testing.T) {
		stored := map[string]string{
			utils.AnnoKeyManagerKind:     "repo",
			utils.AnnoKeyManagerIdentity: "my-repo",
			utils.AnnoKeySourcePath:      "dashboards/a.json",
		}
		obj := &metav1.ObjectMeta{}
		dashboardLike.Apply(obj, stored)
		require.Equal(t, stored, dashboardLike.ToStore(obj))
	})
}

func TestCheckManagerGates(t *testing.T) {
	managed := func(kind utils.ManagerKind, id string) metav1.Object {
		obj := &unstructured.Unstructured{Object: map[string]any{}}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{Kind: kind, Identity: id})
		return obj
	}
	unmanaged := func() metav1.Object { return &unstructured.Unstructured{Object: map[string]any{}} }

	provisioningCtx, _, err := identity.WithProvisioningIdentity(context.Background(), "default")
	require.NoError(t, err)
	userCtx := identity.WithRequester(context.Background(),
		&identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "uuu"})

	t.Run("a repo-managed write is a 403, not the routing sentinel", func(t *testing.T) {
		// Unified storage answers this by re-routing to git; SQL cannot, so the
		// sentinel must not reach the client as a bare error.
		err := CheckManagerOnCreate(userCtx, managed(utils.ManagerKindRepo, "my-repo"))
		require.True(t, apierrors.IsForbidden(err), "expected a forbidden response: %v", err)
		require.NotErrorIs(t, err, identity.ErrResourceIsManagedInRepository)
	})

	t.Run("the provisioner may write its own resources", func(t *testing.T) {
		require.NoError(t, CheckManagerOnCreate(provisioningCtx, managed(utils.ManagerKindRepo, "my-repo")))
		require.NoError(t, CheckManagerOnDelete(provisioningCtx, managed(utils.ManagerKindRepo, "my-repo")))
	})

	t.Run("manager immutability", func(t *testing.T) {
		err := CheckManagerOnUpdate(provisioningCtx,
			managed(utils.ManagerKindTerraform, "my-repo"), managed(utils.ManagerKindRepo, "my-repo"))
		require.True(t, utils.IsForbiddenManagerKindChangeError(err), "expected a kind-change conflict: %v", err)
	})

	t.Run("an unmanaged write needs no identity", func(t *testing.T) {
		bare := context.Background()
		require.NoError(t, CheckManagerOnCreate(bare, unmanaged()))
		require.NoError(t, CheckManagerOnUpdate(bare, unmanaged(), unmanaged()))
		require.NoError(t, CheckManagerOnDelete(bare, unmanaged()))
	})
}
