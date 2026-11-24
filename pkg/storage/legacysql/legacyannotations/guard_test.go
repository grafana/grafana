package legacyannotations

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	authtypes "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func withAnnotations(annotations map[string]string) metav1.Object {
	obj := &unstructured.Unstructured{Object: map[string]any{}}
	obj.SetAnnotations(annotations)
	return obj
}

func managedBy(kind utils.ManagerKind, id string, extra ...string) metav1.Object {
	annotations := map[string]string{utils.AnnoKeyManagerKind: string(kind)}
	if id != "" {
		annotations[utils.AnnoKeyManagerIdentity] = id
	}
	for i := 0; i+1 < len(extra); i += 2 {
		annotations[extra[i]] = extra[i+1]
	}
	return withAnnotations(annotations)
}

func TestGuard(t *testing.T) {
	guard := Guard{Resource: schema.GroupResource{Group: "test.grafana.app", Resource: "things"}}
	unmanaged := func() metav1.Object { return withAnnotations(nil) }

	provisioningCtx, _, err := identity.WithProvisioningIdentity(context.Background(), "default")
	require.NoError(t, err)
	userCtx := identity.WithRequester(context.Background(),
		&identity.StaticRequester{Type: authtypes.TypeUser, UserUID: "uuu"})

	t.Run("a repo-managed write is a 403, not the routing sentinel", func(t *testing.T) {
		// Unified storage answers this by re-routing to git; SQL cannot, so the
		// sentinel must not reach the client as a bare error.
		err := guard.OnCreate(userCtx, managedBy(utils.ManagerKindRepo, "my-repo"))
		require.True(t, apierrors.IsForbidden(err), "expected a forbidden response: %v", err)
		require.NotErrorIs(t, err, identity.ErrResourceIsManagedInRepository)
	})

	t.Run("the provisioner may write its own resources", func(t *testing.T) {
		require.NoError(t, guard.OnCreate(provisioningCtx, managedBy(utils.ManagerKindRepo, "my-repo")))
		require.NoError(t, guard.OnDelete(provisioningCtx, managedBy(utils.ManagerKindRepo, "my-repo")))
	})

	t.Run("manager immutability", func(t *testing.T) {
		err := guard.OnUpdate(provisioningCtx,
			managedBy(utils.ManagerKindTerraform, "my-repo"), managedBy(utils.ManagerKindRepo, "my-repo"))
		require.True(t, utils.IsForbiddenManagerKindChangeError(err), "expected a kind-change conflict: %v", err)
	})

	t.Run("an unmanaged write needs no identity", func(t *testing.T) {
		bare := context.Background()
		require.NoError(t, guard.OnCreate(bare, unmanaged()))
		require.NoError(t, guard.OnUpdate(bare, unmanaged(), unmanaged()))
		require.NoError(t, guard.OnDelete(bare, unmanaged()))
	})

	t.Run("a kind with no identity is gated, though a reader calls it unmanaged", func(t *testing.T) {
		halfFilled := func() metav1.Object { return managedBy(utils.ManagerKindRepo, "") }

		meta, err := utils.MetaAccessor(halfFilled())
		require.NoError(t, err)
		_, managed := meta.GetManagerProperties()
		require.False(t, managed, "the reader still says unmanaged")

		require.True(t, apierrors.IsForbidden(guard.OnCreate(userCtx, halfFilled())))
		// The same assignment on an update must not slip past because both sides read
		// as unmanaged: SQL would persist the kind and a user could not then delete it.
		require.True(t, apierrors.IsForbidden(guard.OnUpdate(userCtx, halfFilled(), unmanaged())))
		require.NoError(t, guard.OnUpdate(provisioningCtx, halfFilled(), unmanaged()))
	})

	t.Run("a file-provisioned resource that allows no edits is read-only except to the provisioner", func(t *testing.T) {
		locked := managedBy(utils.ManagerKindClassicFP, "prom.yaml")   //nolint:staticcheck
		editable := managedBy(utils.ManagerKindClassicFP, "prom.yaml", //nolint:staticcheck
			utils.AnnoKeyManagerAllowsEdits, "true")
		serviceCtx := identity.WithServiceIdentityContext(context.Background(), 1)

		require.True(t, apierrors.IsForbidden(guard.OnUpdate(userCtx, locked, locked)))
		require.True(t, apierrors.IsForbidden(guard.OnDelete(userCtx, locked)))
		require.NoError(t, guard.OnUpdate(userCtx, editable, editable))
		require.NoError(t, guard.OnUpdate(serviceCtx, locked, locked))

		terraform := managedBy(utils.ManagerKindTerraform, "tf")
		require.NoError(t, guard.OnUpdate(userCtx, terraform, terraform),
			"terraform writes through a user's token, so it cannot be told apart and is not gated")
	})
}

func TestRetainOnPut(t *testing.T) {
	stored := func() metav1.Object { return managedBy(utils.ManagerKindTerraform, "tf") }
	ctxWithVerb := func(verb string) context.Context {
		return request.WithRequestInfo(context.Background(), &request.RequestInfo{Verb: verb})
	}

	t.Run("a PUT with no annotations keeps the stored ones", func(t *testing.T) {
		proposed := withAnnotations(nil)
		RetainOnPut(ctxWithVerb("update"), proposed, stored())
		require.Equal(t, stored().GetAnnotations(), proposed.GetAnnotations())
	})

	t.Run("a PUT with annotations is taken as sent", func(t *testing.T) {
		proposed := withAnnotations(map[string]string{"a": "b"})
		RetainOnPut(ctxWithVerb("update"), proposed, stored())
		require.Equal(t, map[string]string{"a": "b"}, proposed.GetAnnotations())
	})

	t.Run("a PATCH that cleared them releases the resource", func(t *testing.T) {
		proposed := withAnnotations(nil)
		RetainOnPut(ctxWithVerb("patch"), proposed, stored())
		require.Empty(t, proposed.GetAnnotations())
	})
}
