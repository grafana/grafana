package bootstrap

import (
	"context"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	k8stesting "k8s.io/client-go/testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
)

const testGroupVersion = "provisioning.grafana.app/v0alpha1"

var (
	repoGVR     = provisioning.RepositoryResourceInfo.GroupVersionResource()
	connGVR     = provisioning.ConnectionResourceInfo.GroupVersionResource()
	repoBetaGVR = schema.GroupVersionResource{Group: repoGVR.Group, Version: "v1beta1", Resource: repoGVR.Resource}
)

func newScheme() *runtime.Scheme {
	scheme := runtime.NewScheme()
	for _, version := range []string{repoGVR.Version, "v1beta1"} {
		gv := schema.GroupVersion{Group: repoGVR.Group, Version: version}
		scheme.AddKnownTypeWithName(gv.WithKind("Repository"), &unstructured.Unstructured{})
		scheme.AddKnownTypeWithName(gv.WithKind("RepositoryList"), &unstructured.UnstructuredList{})
		scheme.AddKnownTypeWithName(gv.WithKind("Connection"), &unstructured.Unstructured{})
		scheme.AddKnownTypeWithName(gv.WithKind("ConnectionList"), &unstructured.UnstructuredList{})
	}
	return scheme
}

func manifest(kind, name string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": testGroupVersion,
		"kind":       kind,
		"metadata":   map[string]any{"name": name, "namespace": "default"},
		"spec":       map[string]any{"title": name},
		"status":     map[string]any{"observedGeneration": int64(7)},
	}}
}

func managed(obj *unstructured.Unstructured, kind utils.ManagerKind, id string) *unstructured.Unstructured {
	obj.SetAnnotations(map[string]string{
		utils.AnnoKeyManagerKind:     string(kind),
		utils.AnnoKeyManagerIdentity: id,
	})
	return obj
}

func newApplier(t *testing.T, objs ...runtime.Object) (*Applier, *dynamicfake.FakeDynamicClient) {
	t.Helper()
	client := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(newScheme(), map[schema.GroupVersionResource]string{
		repoGVR:     "RepositoryList",
		connGVR:     "ConnectionList",
		repoBetaGVR: "RepositoryList",
	}, objs...)
	return NewApplier(client, []byte("test-digest-key"), log.NewNopLogger()), client
}

func TestKindPriority(t *testing.T) {
	assert.Less(t, kindPriority("Connection"), kindPriority("Repository"),
		"connections must be applied before repositories")
}

func TestApply_CreatesWithManagerAndStripsStatus(t *testing.T) {
	applier, client := newApplier(t)

	var created *unstructured.Unstructured
	client.PrependReactor("create", "repositories", func(action k8stesting.Action) (bool, runtime.Object, error) {
		created = action.(k8stesting.CreateAction).GetObject().(*unstructured.Unstructured)
		return true, created, nil
	})

	applier.Apply(context.Background(), []*unstructured.Unstructured{manifest("Repository", "r")})

	require.NotNil(t, created, "expected a create call")
	_, hasStatus, _ := unstructured.NestedMap(created.Object, "status")
	assert.False(t, hasStatus, "status must be stripped before create")

	mgr, ok := getManager(created)
	require.True(t, ok)
	assert.Equal(t, utils.ManagerKindFileProvisioning, mgr.Kind)
	assert.Equal(t, managerIdentity, mgr.Identity)
	assert.False(t, mgr.AllowsEdits)
}

func TestApply_PreservesPlaintextSecureValue(t *testing.T) {
	applier, client := newApplier(t)

	var created *unstructured.Unstructured
	client.PrependReactor("create", "repositories", func(action k8stesting.Action) (bool, runtime.Object, error) {
		created = action.(k8stesting.CreateAction).GetObject().(*unstructured.Unstructured)
		return true, created, nil
	})

	obj := manifest("Repository", "r")
	require.NoError(t, unstructured.SetNestedField(obj.Object, "plaintext-token", "secure", "token", "create"))
	applier.Apply(context.Background(), []*unstructured.Unstructured{obj})

	require.NotNil(t, created)
	// The dynamic client must forward the real value (not the redacted typed RawSecureValue).
	val, _, _ := unstructured.NestedString(created.Object, "secure", "token", "create")
	assert.Equal(t, "plaintext-token", val)
}

func TestApply_TargetsManifestNamespace(t *testing.T) {
	applier, client := newApplier(t)

	var gotNamespace string
	client.PrependReactor("create", "repositories", func(action k8stesting.Action) (bool, runtime.Object, error) {
		gotNamespace = action.GetNamespace()
		return true, action.(k8stesting.CreateAction).GetObject(), nil
	})

	obj := manifest("Repository", "r")
	obj.SetNamespace("org-2") // selects org 2
	applier.Apply(context.Background(), []*unstructured.Unstructured{obj})

	assert.Equal(t, "org-2", gotNamespace, "manifest namespace selects the target org")
}

func TestApply_SkipsForeignManaged(t *testing.T) {
	applier, client := newApplier(t, managed(manifest("Repository", "r"), utils.ManagerKindTerraform, "some-workspace"))

	updated := false
	client.PrependReactor("update", "*", func(k8stesting.Action) (bool, runtime.Object, error) {
		updated = true
		return true, nil, nil
	})

	applier.Apply(context.Background(), []*unstructured.Unstructured{manifest("Repository", "r")})
	assert.False(t, updated, "must not overwrite a resource managed by another manager")
}

func TestApply_ReconcilesOwnManaged(t *testing.T) {
	applier, client := newApplier(t, managed(manifest("Repository", "r"), utils.ManagerKindFileProvisioning, managerIdentity))

	updated := false
	client.PrependReactor("update", "*", func(k8stesting.Action) (bool, runtime.Object, error) {
		updated = true
		return true, nil, nil
	})

	applier.Apply(context.Background(), []*unstructured.Unstructured{manifest("Repository", "r")})
	assert.True(t, updated, "resources we own must be reconciled")
}

func TestApply_OrdersConnectionsBeforeRepositories(t *testing.T) {
	applier, client := newApplier(t)

	var order []string
	record := func(resource string) k8stesting.ReactionFunc {
		return func(action k8stesting.Action) (bool, runtime.Object, error) {
			order = append(order, resource)
			return true, action.(k8stesting.CreateAction).GetObject(), nil
		}
	}
	client.PrependReactor("create", "repositories", record("repository"))
	client.PrependReactor("create", "connections", record("connection"))

	// Intentionally pass repository first; the applier must still order the connection first.
	applier.Apply(context.Background(), []*unstructured.Unstructured{
		manifest("Repository", "r"),
		manifest("Connection", "c"),
	})

	require.Equal(t, []string{"connection", "repository"}, order)
}

func TestApply_SkipsUnsupportedKind(t *testing.T) {
	applier, client := newApplier(t)

	created := false
	client.PrependReactor("create", "*", func(k8stesting.Action) (bool, runtime.Object, error) {
		created = true
		return true, nil, nil
	})

	// Dashboards and other kinds are provisioned by Git Sync itself, not the bootstrap.
	applier.Apply(context.Background(), []*unstructured.Unstructured{manifest("Dashboard", "d")})
	assert.False(t, created, "non-provisioning kinds must be skipped")
}

func TestApply_OneFailureDoesNotAbortBatch(t *testing.T) {
	applier, client := newApplier(t)

	applied := map[string]bool{}
	client.PrependReactor("create", "connections", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, assert.AnError
	})
	client.PrependReactor("create", "repositories", func(action k8stesting.Action) (bool, runtime.Object, error) {
		applied[action.(k8stesting.CreateAction).GetObject().(*unstructured.Unstructured).GetName()] = true
		return true, action.(k8stesting.CreateAction).GetObject(), nil
	})

	applier.Apply(context.Background(), []*unstructured.Unstructured{
		manifest("Connection", "c"),
		manifest("Repository", "r"),
	})

	assert.True(t, applied["r"], "repository should still be applied after the connection fails")
}

func withSecureCreate(obj *unstructured.Unstructured, key, value string) *unstructured.Unstructured {
	if err := unstructured.SetNestedField(obj.Object, value, "secure", key, "create"); err != nil {
		panic(err)
	}
	return obj
}

// A Connection manifest replayed unchanged on every boot used to resend secure.*.create, which
// admission treats as an OAuth app change: it removes the authorized token and forces reauthorization.
func TestApply_DoesNotReplayUnchangedSecureValues(t *testing.T) {
	stored := managed(manifest("Connection", "c"), utils.ManagerKindFileProvisioning, managerIdentity)
	stored.SetAnnotations(map[string]string{
		utils.AnnoKeyManagerKind:     string(utils.ManagerKindFileProvisioning),
		utils.AnnoKeyManagerIdentity: managerIdentity,
		secureDigestAnnotation:       storedDigests(t, "Connection", "c", map[string]string{"clientSecret": "same-secret"}),
	})

	applier, client := newApplier(t, stored)

	var updated *unstructured.Unstructured
	client.PrependReactor("update", "connections", func(action k8stesting.Action) (bool, runtime.Object, error) {
		updated = action.(k8stesting.UpdateAction).GetObject().(*unstructured.Unstructured)
		return true, updated, nil
	})

	applier.Apply(context.Background(), []*unstructured.Unstructured{
		withSecureCreate(manifest("Connection", "c"), "clientSecret", "same-secret"),
	})

	require.NotNil(t, updated, "the connection should still be reconciled")
	_, hasCreate, _ := unstructured.NestedString(updated.Object, "secure", "clientSecret", "create")
	assert.False(t, hasCreate, "an unchanged secret must not be re-created")
}

func TestApply_ReplaysChangedSecureValues(t *testing.T) {
	stored := manifest("Connection", "c")
	stored.SetAnnotations(map[string]string{
		utils.AnnoKeyManagerKind:     string(utils.ManagerKindFileProvisioning),
		utils.AnnoKeyManagerIdentity: managerIdentity,
		secureDigestAnnotation:       storedDigests(t, "Connection", "c", map[string]string{"clientSecret": "old-secret"}),
	})

	applier, client := newApplier(t, stored)

	var updated *unstructured.Unstructured
	client.PrependReactor("update", "connections", func(action k8stesting.Action) (bool, runtime.Object, error) {
		updated = action.(k8stesting.UpdateAction).GetObject().(*unstructured.Unstructured)
		return true, updated, nil
	})

	applier.Apply(context.Background(), []*unstructured.Unstructured{
		withSecureCreate(manifest("Connection", "c"), "clientSecret", "rotated-secret"),
	})

	require.NotNil(t, updated)
	create, _, _ := unstructured.NestedString(updated.Object, "secure", "clientSecret", "create")
	assert.Equal(t, "rotated-secret", create, "a changed manifest value must still rotate the secret")
}

func TestApply_RecordsSecureDigestOnCreate(t *testing.T) {
	applier, client := newApplier(t)

	var created *unstructured.Unstructured
	client.PrependReactor("create", "connections", func(action k8stesting.Action) (bool, runtime.Object, error) {
		created = action.(k8stesting.CreateAction).GetObject().(*unstructured.Unstructured)
		return true, created, nil
	})

	obj := withSecureCreate(manifest("Connection", "c"), "clientSecret", "s3cret")
	applier.Apply(context.Background(), []*unstructured.Unstructured{obj})

	require.NotNil(t, created)
	assert.NotEmpty(t, created.GetAnnotations()[secureDigestAnnotation],
		"the digest must be stored so the next boot can tell the value is unchanged")
	create, _, _ := unstructured.NestedString(created.Object, "secure", "clientSecret", "create")
	assert.Equal(t, "s3cret", create, "the first apply must still create the secret")
}

func TestSecureDigests_ExcludesReferencesAndBindsToIdentity(t *testing.T) {
	applier, _ := newApplier(t)

	assert.Nil(t, applier.secureDigests(manifest("Connection", "c")), "no secure block means no digests")

	refOnly := manifest("Connection", "c")
	require.NoError(t, unstructured.SetNestedField(refOnly.Object, "some-ref", "secure", "clientSecret", "name"))
	assert.Nil(t, applier.secureDigests(refOnly), "a reference is not a create directive")

	both := withSecureCreate(withSecureCreate(manifest("Connection", "c"), "clientSecret", "cs"), "token", "tok")
	digests := applier.secureDigests(both)
	assert.Len(t, digests, 2, "each create gets its own digest")
	assert.NotEqual(t, digests["clientSecret"], digests["token"], "the key is part of the digest")

	elsewhere := withSecureCreate(manifest("Connection", "c"), "clientSecret", "cs")
	elsewhere.SetNamespace("org-2")
	assert.NotEqual(t, applier.secureDigests(both)["clientSecret"], applier.secureDigests(elsewhere)["clientSecret"],
		"the same secret in another org must not produce the same digest")

	other := NewApplier(nil, []byte("another-key"), log.NewNopLogger())
	assert.NotEqual(t, applier.secureDigests(both)["clientSecret"], other.secureDigests(both)["clientSecret"],
		"the digest must be keyed, so an identical manifest elsewhere does not match")
}

// A Repository kind from an unrelated API group was routed to the provisioning API, because the
// endpoint was selected by kind alone.
func TestApply_SkipsSupportedKindFromForeignGroup(t *testing.T) {
	applier, client := newApplier(t)

	called := false
	client.PrependReactor("*", "*", func(k8stesting.Action) (bool, runtime.Object, error) {
		called = true
		return true, nil, nil
	})

	obj := manifest("Repository", "r")
	obj.SetAPIVersion("example.com/v1")
	applier.Apply(context.Background(), []*unstructured.Unstructured{obj})

	assert.False(t, called, "only provisioning.grafana.app manifests may reach the provisioning API")
}

func TestApply_RejectsUnservedAPIVersion(t *testing.T) {
	applier, client := newApplier(t)

	called := false
	client.PrependReactor("*", "*", func(k8stesting.Action) (bool, runtime.Object, error) {
		called = true
		return true, nil, nil
	})

	obj := manifest("Repository", "r")
	obj.SetAPIVersion(repoGVR.Group + "/v9")
	applier.Apply(context.Background(), []*unstructured.Unstructured{obj})

	assert.False(t, called, "a version this Grafana does not serve must not be rewritten to a served one")
}

// A status patch landing between the read and the write made the copied resource version stale;
// the conflict was only logged, leaving the configuration change unapplied until the next boot.
func TestApply_RetriesOnResourceVersionConflict(t *testing.T) {
	stored := managed(manifest("Repository", "r"), utils.ManagerKindFileProvisioning, managerIdentity)
	applier, client := newApplier(t, stored)

	attempts := 0
	client.PrependReactor("update", "repositories", func(action k8stesting.Action) (bool, runtime.Object, error) {
		attempts++
		if attempts == 1 {
			return true, nil, apierrors.NewConflict(repoGVR.GroupResource(), "r", assert.AnError)
		}
		return true, action.(k8stesting.UpdateAction).GetObject(), nil
	})

	applier.Apply(context.Background(), []*unstructured.Unstructured{manifest("Repository", "r")})

	assert.Equal(t, 2, attempts, "a conflicting update must be retried against a fresh read")
}

func TestApply_RetriesWhenAnotherReplicaCreatesFirst(t *testing.T) {
	applier, client := newApplier(t)

	client.PrependReactor("create", "repositories", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewAlreadyExists(repoGVR.GroupResource(), "r")
	})

	gets := 0
	client.PrependReactor("get", "repositories", func(k8stesting.Action) (bool, runtime.Object, error) {
		gets++
		if gets == 1 {
			return true, nil, apierrors.NewNotFound(repoGVR.GroupResource(), "r")
		}
		return true, managed(manifest("Repository", "r"), utils.ManagerKindFileProvisioning, managerIdentity), nil
	})

	updated := false
	client.PrependReactor("update", "repositories", func(action k8stesting.Action) (bool, runtime.Object, error) {
		updated = true
		return true, action.(k8stesting.UpdateAction).GetObject(), nil
	})

	applier.Apply(context.Background(), []*unstructured.Unstructured{manifest("Repository", "r")})

	assert.True(t, updated, "losing the create race must fall through to the update path")
}

// storedDigests builds the annotation a previous apply of these create values would have left.
func storedDigests(t *testing.T, kind, name string, creates map[string]string) string {
	t.Helper()
	applier, _ := newApplier(t)
	obj := manifest(kind, name)
	for key, value := range creates {
		withSecureCreate(obj, key, value)
	}
	return marshalDigests(applier.secureDigests(obj))
}

func withGitHubURL(obj *unstructured.Unstructured, url string) *unstructured.Unstructured {
	if err := unstructured.SetNestedField(obj.Object, "github", "spec", "type"); err != nil {
		panic(err)
	}
	if err := unstructured.SetNestedField(obj.Object, url, "spec", "github", "url"); err != nil {
		panic(err)
	}
	return obj
}

// Rotating only the token on a Connection that also declares a client secret used to resend the
// unchanged client secret, which admission reads as an OAuth app change: it discards the new token.
func TestApply_RotatesOneSecureValueWithoutResendingTheOthers(t *testing.T) {
	stored := managed(manifest("Connection", "c"), utils.ManagerKindFileProvisioning, managerIdentity)
	annotations := stored.GetAnnotations()
	annotations[secureDigestAnnotation] = storedDigests(t, "Connection", "c", map[string]string{
		"clientSecret": "unchanged-secret",
		"token":        "old-token",
	})
	stored.SetAnnotations(annotations)

	applier, client := newApplier(t, stored)

	var updated *unstructured.Unstructured
	client.PrependReactor("update", "connections", func(action k8stesting.Action) (bool, runtime.Object, error) {
		updated = action.(k8stesting.UpdateAction).GetObject().(*unstructured.Unstructured)
		return true, updated, nil
	})

	desired := withSecureCreate(manifest("Connection", "c"), "clientSecret", "unchanged-secret")
	withSecureCreate(desired, "token", "rotated-token")
	applier.Apply(context.Background(), []*unstructured.Unstructured{desired})

	require.NotNil(t, updated)
	token, _, _ := unstructured.NestedString(updated.Object, "secure", "token", "create")
	assert.Equal(t, "rotated-token", token, "the changed value must be applied")
	_, hasClientSecret, _ := unstructured.NestedString(updated.Object, "secure", "clientSecret", "create")
	assert.False(t, hasClientSecret, "an unchanged client secret must not ride along and drop the token")
}

// Pointing a repository at another URL with the same PAT used to have its token stripped as
// unchanged, which admission rejects: it requires an explicit token whenever the URL changes.
func TestApply_KeepsTokenWhenRepositoryURLChanges(t *testing.T) {
	stored := withGitHubURL(managed(manifest("Repository", "r"), utils.ManagerKindFileProvisioning, managerIdentity), "https://github.com/acme/old")
	annotations := stored.GetAnnotations()
	annotations[secureDigestAnnotation] = storedDigests(t, "Repository", "r", map[string]string{"token": "same-pat"})
	stored.SetAnnotations(annotations)

	applier, client := newApplier(t, stored)

	var updated *unstructured.Unstructured
	client.PrependReactor("update", "repositories", func(action k8stesting.Action) (bool, runtime.Object, error) {
		updated = action.(k8stesting.UpdateAction).GetObject().(*unstructured.Unstructured)
		return true, updated, nil
	})

	desired := withSecureCreate(withGitHubURL(manifest("Repository", "r"), "https://github.com/acme/new"), "token", "same-pat")
	applier.Apply(context.Background(), []*unstructured.Unstructured{desired})

	require.NotNil(t, updated)
	token, _, _ := unstructured.NestedString(updated.Object, "secure", "token", "create")
	assert.Equal(t, "same-pat", token, "the token must be resent so the URL change is accepted")
}

func TestApply_DropsUnchangedTokenWhenURLIsUnchanged(t *testing.T) {
	stored := withGitHubURL(managed(manifest("Repository", "r"), utils.ManagerKindFileProvisioning, managerIdentity), "https://github.com/acme/same")
	annotations := stored.GetAnnotations()
	annotations[secureDigestAnnotation] = storedDigests(t, "Repository", "r", map[string]string{"token": "same-pat"})
	stored.SetAnnotations(annotations)

	applier, client := newApplier(t, stored)

	var updated *unstructured.Unstructured
	client.PrependReactor("update", "repositories", func(action k8stesting.Action) (bool, runtime.Object, error) {
		updated = action.(k8stesting.UpdateAction).GetObject().(*unstructured.Unstructured)
		return true, updated, nil
	})

	desired := withSecureCreate(withGitHubURL(manifest("Repository", "r"), "https://github.com/acme/same"), "token", "same-pat")
	applier.Apply(context.Background(), []*unstructured.Unstructured{desired})

	require.NotNil(t, updated)
	_, hasToken, _ := unstructured.NestedString(updated.Object, "secure", "token", "create")
	assert.False(t, hasToken, "an unchanged token on an unchanged URL must not be re-created")
}

// v1beta1 is registered alongside v0alpha1, so a manifest naming it must reach that endpoint
// instead of being rejected or silently applied to v0alpha1.
func TestApply_AppliesServedV1Beta1ToItsOwnEndpoint(t *testing.T) {
	applier, client := newApplier(t)

	var gotVersion string
	client.PrependReactor("create", "repositories", func(action k8stesting.Action) (bool, runtime.Object, error) {
		gotVersion = action.GetResource().Version
		return true, action.(k8stesting.CreateAction).GetObject(), nil
	})

	obj := manifest("Repository", "r")
	obj.SetAPIVersion(repoGVR.Group + "/v1beta1")
	applier.Apply(context.Background(), []*unstructured.Unstructured{obj})

	assert.Equal(t, "v1beta1", gotVersion, "the manifest's own version selects the endpoint")
}
