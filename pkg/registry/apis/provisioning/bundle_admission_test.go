package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"

	authtypes "github.com/grafana/authlib/types"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func bundleAttributes(obj runtime.Object) admission.Attributes {
	return admission.NewAttributesRecord(obj, nil, provisioning.BundleResourceInfo.GroupVersionKind(),
		"default", "sample", provisioning.BundleResourceInfo.GroupVersionResource(),
		"", admission.Create, nil, false, nil)
}

func bundleFileAttributes(obj runtime.Object) admission.Attributes {
	return admission.NewAttributesRecord(obj, nil, provisioning.BundleFileResourceInfo.GroupVersionKind(),
		"default", "sample-aaaaaaaaaaaa", provisioning.BundleFileResourceInfo.GroupVersionResource(),
		"", admission.Create, nil, false, nil)
}

func TestBundleAdmissionValidator(t *testing.T) {
	v := newBundleAdmissionValidator()
	ctx := context.Background()

	t.Run("accepts files and folders", func(t *testing.T) {
		bundle := &provisioning.Bundle{
			ObjectMeta: metav1.ObjectMeta{Name: "sample"},
			Spec: provisioning.BundleSpec{Paths: []string{
				"bundles/sample/README.md",
				"bundles/sample/docs/",
				"shared/query.sql",
			}},
		}

		require.NoError(t, v.Validate(ctx, bundleAttributes(bundle), nil))
	})

	t.Run("accepts an empty path set", func(t *testing.T) {
		bundle := &provisioning.Bundle{ObjectMeta: metav1.ObjectMeta{Name: "sample"}}
		require.NoError(t, v.Validate(ctx, bundleAttributes(bundle), nil))
	})

	t.Run("applies the same path rules as the parser", func(t *testing.T) {
		// A Bundle written straight to the API has to be as valid as one read from a
		// repository, or its contents would depend on how it arrived.
		for _, paths := range [][]string{
			{"../../etc/passwd"},
			{"/etc/passwd"},
			{"bundles/.secret/notes.md"},
			{"bundles/sample/a.md", "bundles/sample/a.md"},
			{"   "},
			{"/"},
		} {
			bundle := &provisioning.Bundle{
				ObjectMeta: metav1.ObjectMeta{Name: "sample"},
				Spec:       provisioning.BundleSpec{Paths: paths},
			}

			err := v.Validate(ctx, bundleAttributes(bundle), nil)
			require.Error(t, err, "expected %v to be rejected", paths)
			assert.True(t, apierrors.IsInvalid(err), "expected Invalid, got %v", err)
		}
	})

	t.Run("ignores an object being deleted", func(t *testing.T) {
		now := metav1.Now()
		bundle := &provisioning.Bundle{
			ObjectMeta: metav1.ObjectMeta{Name: "sample", DeletionTimestamp: &now},
			Spec:       provisioning.BundleSpec{Paths: []string{"../../etc/passwd"}},
		}

		require.NoError(t, v.Validate(ctx, bundleAttributes(bundle), nil))
	})

	t.Run("rejects a non-bundle object", func(t *testing.T) {
		err := v.Validate(ctx, bundleAttributes(&provisioning.Job{}), nil)
		require.Error(t, err)
	})
}

func TestBundleFileAdmissionValidator(t *testing.T) {
	v := newBundleFileAdmissionValidator()

	valid := func() *provisioning.BundleFile {
		return &provisioning.BundleFile{
			ObjectMeta: metav1.ObjectMeta{Name: "sample-aaaaaaaaaaaa"},
			Spec: provisioning.BundleFileSpec{
				Repository: "acme-repo",
				Bundle:     "sample",
				Path:       "bundles/sample/a.md",
			},
		}
	}

	t.Run("accepts a write that is not from a user", func(t *testing.T) {
		// The reconciler writes as a service identity; that is the only writer there
		// should be.
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		require.NoError(t, v.Validate(ctx, bundleFileAttributes(valid()), nil))
	})

	t.Run("refuses a write from a user", func(t *testing.T) {
		// Denying the verb in the authorizer is not an option: the reconciler
		// authorizes through the same path, so it would be blocked too.
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type:   authtypes.TypeUser,
			Name:   "editor",
			UserID: 1,
			OrgID:  1,
		})

		err := v.Validate(ctx, bundleFileAttributes(valid()), nil)
		require.Error(t, err)
		assert.True(t, apierrors.IsInvalid(err), "expected Invalid, got %v", err)
		assert.Contains(t, err.Error(), "cannot be edited directly")
	})

	t.Run("requires the bundle and the path", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)

		noBundle := valid()
		noBundle.Spec.Bundle = ""
		require.Error(t, v.Validate(ctx, bundleFileAttributes(noBundle), nil))

		noPath := valid()
		noPath.Spec.Path = ""
		require.Error(t, v.Validate(ctx, bundleFileAttributes(noPath), nil))
	})

	t.Run("ignores an object being deleted", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type: authtypes.TypeUser, Name: "editor", UserID: 1, OrgID: 1,
		})
		now := metav1.Now()
		file := valid()
		file.DeletionTimestamp = &now

		require.NoError(t, v.Validate(ctx, bundleFileAttributes(file), nil))
	})
}
