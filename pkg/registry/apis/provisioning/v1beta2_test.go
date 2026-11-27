package provisioning

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/utils/ptr"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta2"
	"github.com/grafana/grafana/apps/provisioning/pkg/loki"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

func newV1beta2TestBuilder(t *testing.T, inner *APIBuilder) (*v1beta2APIBuilder, *runtime.Scheme) {
	t.Helper()
	scheme := runtime.NewScheme()
	require.NoError(t, provisioning.AddKnownTypes(provisioning.SchemeGroupVersion, scheme))
	require.NoError(t, provisioning.AddKnownTypes(schema.GroupVersion{Group: provisioning.GROUP, Version: "v1beta1"}, scheme))
	b := newV1beta2APIBuilder(inner)
	require.NoError(t, b.InstallSchema(scheme))
	return b, scheme
}

func testV1beta2Repository() *v1beta2.Repository {
	return &v1beta2.Repository{
		TypeMeta: metav1.TypeMeta{APIVersion: v1beta2.GroupVersion.String(), Kind: "Repository"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "repo",
			Namespace: "default",
			Labels:    map[string]string{"team": "platform"},
		},
		Spec: v1beta2.RepositorySpec{
			Title:       "Repository",
			Description: ptr.To("All the dashboards"),
			Workflows:   []v1beta2.RepositorySpecWorkflows{v1beta2.RepositorySpecWorkflowsWrite},
			Sync: v1beta2.RepositorySyncOptions{
				Enabled:         true,
				Target:          v1beta2.RepositorySyncOptionsTargetFolder,
				IntervalSeconds: ptr.To(int64(60)),
			},
			Type: v1beta2.RepositorySpecTypeGithub,
			Github: &v1beta2.RepositoryGitHubRepositoryConfig{
				Url:    ptr.To("https://github.com/example/test"),
				Branch: "main",
			},
			Connection: &v1beta2.RepositoryConnectionInfo{Name: "my-connection"},
		},
		Secure: resource.InlineSecureValues{
			v1beta2.RepositorySecureToken: {Name: "token-secret"},
		},
		Status: v1beta2.RepositoryStatus{
			ObservedGeneration: 2,
			Conditions: []v1beta2.RepositoryCondition{{
				Type:               "Ready",
				Status:             "True",
				LastTransitionTime: ptr.To("2026-11-20T10:00:00Z"),
				Reason:             "Available",
				Message:            "ok",
			}},
		},
	}
}

func TestV1beta2StorageSerializer(t *testing.T) {
	_, scheme := newV1beta2TestBuilder(t, &APIBuilder{})
	serializer := &v1beta2StorageSerializer{scheme: scheme}
	ctx := context.Background()

	t.Run("persists the storage version", func(t *testing.T) {
		raw, err := serializer.Encode(ctx, testV1beta2Repository())
		require.NoError(t, err)

		var stored provisioning.Repository
		require.NoError(t, json.Unmarshal(raw, &stored))
		assert.Equal(t, provisioning.APIVERSION, stored.APIVersion)
		assert.Equal(t, "Repository", stored.Kind)
		assert.Equal(t, "https://github.com/example/test", stored.Spec.GitHub.URL)
		assert.Equal(t, "my-connection", stored.Spec.Connection.Name)
		assert.Equal(t, "token-secret", stored.Secure.Token.Name)
	})

	t.Run("reads back what it wrote", func(t *testing.T) {
		raw, err := serializer.Encode(ctx, testV1beta2Repository())
		require.NoError(t, err)

		decoded, err := serializer.Decode(ctx, raw, &v1beta2.Repository{})
		require.NoError(t, err)
		assert.Equal(t, testV1beta2Repository(), decoded)
	})

	t.Run("reads objects stored as v1beta1", func(t *testing.T) {
		raw, err := serializer.Encode(ctx, testV1beta2Repository())
		require.NoError(t, err)
		var stored map[string]any
		require.NoError(t, json.Unmarshal(raw, &stored))
		stored["apiVersion"] = provisioning.GROUP + "/v1beta1"
		raw, err = json.Marshal(stored)
		require.NoError(t, err)

		decoded, err := serializer.Decode(ctx, raw, &v1beta2.Repository{})
		require.NoError(t, err)
		assert.Equal(t, testV1beta2Repository(), decoded)
	})

	t.Run("overwrites the destination", func(t *testing.T) {
		raw, err := serializer.Encode(ctx, testV1beta2Repository())
		require.NoError(t, err)

		into := &v1beta2.Repository{Spec: v1beta2.RepositorySpec{Local: &v1beta2.RepositoryLocalRepositoryConfig{Path: ptr.To("left over")}}}
		_, err = serializer.Decode(ctx, raw, into)
		require.NoError(t, err)
		assert.Nil(t, into.Spec.Local)
	})

	for _, obj := range []runtime.Object{
		&v1beta2.Connection{ObjectMeta: metav1.ObjectMeta{Name: "c"}, Spec: v1beta2.ConnectionSpec{Title: "c", Type: v1beta2.ConnectionTypeGithub}},
		&v1beta2.Job{ObjectMeta: metav1.ObjectMeta{Name: "j"}, Spec: v1beta2.JobSpec{Action: v1beta2.JobActionPull, Repository: ptr.To("repo")}},
		&v1beta2.HistoricJob{ObjectMeta: metav1.ObjectMeta{Name: "h"}, Spec: v1beta2.HistoricJobSpec{Action: v1beta2.HistoricJobActionPull}},
	} {
		kind, ok := v1beta2Kind(scheme, obj)
		require.True(t, ok)
		t.Run("round trips a "+kind.Kind, func(t *testing.T) {
			raw, err := serializer.Encode(ctx, obj)
			require.NoError(t, err)
			var meta metav1.TypeMeta
			require.NoError(t, json.Unmarshal(raw, &meta))
			assert.Equal(t, metav1.TypeMeta{APIVersion: provisioning.APIVERSION, Kind: kind.Kind}, meta)

			into, err := scheme.New(kind)
			require.NoError(t, err)
			decoded, err := serializer.Decode(ctx, raw, into)
			require.NoError(t, err)
			obj.GetObjectKind().SetGroupVersionKind(kind)
			assert.Equal(t, obj, decoded)
		})
	}

	t.Run("rejects objects of other versions", func(t *testing.T) {
		_, err := serializer.Encode(ctx, &provisioning.Repository{})
		require.Error(t, err)
		_, err = serializer.Decode(ctx, []byte(`{}`), &provisioning.Repository{})
		require.Error(t, err)
		_, err = serializer.Decode(ctx, []byte(`{}`), nil)
		require.Error(t, err)
	})
}

type recordingAdmission struct {
	mutated, validated admission.Attributes
	mutate             func(a admission.Attributes)
	err                error
}

func (r *recordingAdmission) Mutate(_ context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	r.mutated = a
	if r.mutate != nil {
		r.mutate(a)
	}
	return r.err
}

func (r *recordingAdmission) Validate(_ context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	r.validated = a
	return r.err
}

func repositoryAttributes(obj, old runtime.Object, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(obj, old,
		v1beta2.RepositoryResourceInfo.GroupVersionKind(), "default", "repo",
		v1beta2.RepositoryResourceInfo.GroupVersionResource(), "", op, nil, false, nil)
}

func TestV1beta2Admission(t *testing.T) {
	_, scheme := newV1beta2TestBuilder(t, &APIBuilder{})
	ctx := context.Background()

	t.Run("mutates the storage version and copies the result back", func(t *testing.T) {
		inner := &recordingAdmission{mutate: func(a admission.Attributes) {
			repo, ok := a.GetObject().(*provisioning.Repository)
			require.True(t, ok, "inner admission must see the storage version")
			repo.Spec.Title = "mutated"
			repo.Spec.Sync.IntervalSeconds = 120
		}}
		obj := testV1beta2Repository()
		old := testV1beta2Repository()
		err := (&v1beta2Admission{scheme: scheme, inner: inner}).Mutate(ctx, repositoryAttributes(obj, old, admission.Update), nil)
		require.NoError(t, err)

		assert.IsType(t, &provisioning.Repository{}, inner.mutated.GetOldObject())
		assert.Equal(t, "mutated", obj.Spec.Title)
		assert.Equal(t, ptr.To(int64(120)), obj.Spec.Sync.IntervalSeconds)
		assert.Equal(t, v1beta2.RepositoryResourceInfo.GroupVersionKind(), obj.GroupVersionKind())
		assert.Equal(t, "token-secret", obj.Secure[v1beta2.RepositorySecureToken].Name)
	})

	t.Run("canonicalizes optional zero values and conditions", func(t *testing.T) {
		obj := testV1beta2Repository()
		obj.Spec.Description = ptr.To("")
		obj.Status.Conditions[0].LastTransitionTime = ptr.To("2026-11-20T11:00:00+01:00")
		obj.Status.Conditions[0].ObservedGeneration = ptr.To(int64(0))
		err := (&v1beta2Admission{scheme: scheme, inner: &recordingAdmission{}}).Mutate(ctx, repositoryAttributes(obj, nil, admission.Create), nil)
		require.NoError(t, err)

		assert.Nil(t, obj.Spec.Description)
		assert.Equal(t, ptr.To("2026-11-20T10:00:00Z"), obj.Status.Conditions[0].LastTransitionTime)
		assert.Nil(t, obj.Status.Conditions[0].ObservedGeneration)
	})

	t.Run("validates the storage version", func(t *testing.T) {
		inner := &recordingAdmission{}
		err := (&v1beta2Admission{scheme: scheme, inner: inner}).Validate(ctx, repositoryAttributes(testV1beta2Repository(), nil, admission.Create), nil)
		require.NoError(t, err)
		assert.IsType(t, &provisioning.Repository{}, inner.validated.GetObject())
		assert.Nil(t, inner.validated.GetOldObject())
	})

	t.Run("validates deletes with the old object", func(t *testing.T) {
		inner := &recordingAdmission{}
		err := (&v1beta2Admission{scheme: scheme, inner: inner}).Validate(ctx, repositoryAttributes(nil, testV1beta2Repository(), admission.Delete), nil)
		require.NoError(t, err)
		assert.Nil(t, inner.validated.GetObject())
		assert.IsType(t, &provisioning.Repository{}, inner.validated.GetOldObject())
	})

	t.Run("returns the inner errors", func(t *testing.T) {
		inner := &recordingAdmission{err: apierrors.NewBadRequest("nope")}
		a := &v1beta2Admission{scheme: scheme, inner: inner}
		require.ErrorIs(t, a.Mutate(ctx, repositoryAttributes(testV1beta2Repository(), nil, admission.Create), nil), inner.err)
		require.ErrorIs(t, a.Validate(ctx, repositoryAttributes(testV1beta2Repository(), nil, admission.Create), nil), inner.err)
	})

	t.Run("skips connect and empty objects", func(t *testing.T) {
		inner := &recordingAdmission{}
		a := &v1beta2Admission{scheme: scheme, inner: inner}
		require.NoError(t, a.Mutate(ctx, repositoryAttributes(nil, nil, admission.Create), nil))
		require.NoError(t, a.Mutate(ctx, repositoryAttributes(testV1beta2Repository(), nil, admission.Connect), nil))
		require.NoError(t, a.Validate(ctx, repositoryAttributes(testV1beta2Repository(), nil, admission.Connect), nil))
		assert.Nil(t, inner.mutated)
		assert.Nil(t, inner.validated)
	})

	invalid := []struct {
		name  string
		obj   runtime.Object
		field string
	}{
		{
			name: "unknown repository secure key",
			obj: func() runtime.Object {
				repo := testV1beta2Repository()
				repo.Secure["password"] = resource.InlineSecureValue{Create: "x"}
				return repo
			}(),
			field: "secure[password]",
		},
		{
			name: "unparsable repository condition time",
			obj: func() runtime.Object {
				repo := testV1beta2Repository()
				repo.Status.Conditions[0].LastTransitionTime = ptr.To("yesterday")
				return repo
			}(),
			field: "status.conditions[0].lastTransitionTime",
		},
		{
			name: "unknown connection secure key",
			obj: &v1beta2.Connection{Secure: resource.InlineSecureValues{
				"password": {Create: "x"},
			}},
			field: "secure[password]",
		},
		{
			name: "unparsable connection condition time",
			obj: &v1beta2.Connection{Status: v1beta2.ConnectionStatus{Conditions: []v1beta2.ConnectionCondition{{
				Type: "Ready", LastTransitionTime: ptr.To(""),
			}}}},
			field: "status.conditions[0].lastTransitionTime",
		},
	}
	for _, tc := range invalid {
		t.Run("rejects "+tc.name, func(t *testing.T) {
			inner := &recordingAdmission{}
			a := &v1beta2Admission{scheme: scheme, inner: inner}
			for _, err := range []error{
				a.Mutate(ctx, repositoryAttributes(tc.obj, nil, admission.Create), nil),
				a.Validate(ctx, repositoryAttributes(tc.obj, nil, admission.Create), nil),
			} {
				require.True(t, apierrors.IsInvalid(err), "expected an invalid error, got %v", err)
				assert.Contains(t, err.Error(), tc.field)
			}
			assert.Nil(t, inner.mutated)
			assert.Nil(t, inner.validated)
		})
	}

	t.Run("rejects what the conversion can't represent", func(t *testing.T) {
		job := &v1beta2.Job{Spec: v1beta2.JobSpec{
			Action: v1beta2.JobActionPull,
			Test:   &v1beta2.JobTestJobOptions{Duration: ptr.To("soon")},
		}}
		err := (&v1beta2Admission{scheme: scheme, inner: &recordingAdmission{}}).Validate(ctx, repositoryAttributes(job, nil, admission.Create), nil)
		require.True(t, apierrors.IsBadRequest(err), "expected a bad request, got %v", err)
	})
}

func TestV1beta2APIBuilder(t *testing.T) {
	t.Run("serves historic jobs from unified storage only", func(t *testing.T) {
		names := func(b *v1beta2APIBuilder) []string {
			infos := b.GetResourceInfos(v1beta2.GroupVersion)
			out := make([]string, 0, len(infos))
			for _, info := range infos {
				assert.Equal(t, v1beta2.GroupVersion, info.GroupVersion())
				out = append(out, info.GetName())
			}
			return out
		}
		unified := newV1beta2APIBuilder(&APIBuilder{jobHistoryConfig: &JobHistoryConfig{}})
		assert.Equal(t, []string{"repositories", "connections", "jobs", "historicjobs"}, names(unified))

		withLoki := newV1beta2APIBuilder(&APIBuilder{jobHistoryConfig: &JobHistoryConfig{Loki: &loki.Config{}}})
		assert.Equal(t, []string{"repositories", "connections", "jobs"}, names(withLoki))
	})

	t.Run("requires storage that takes a serializer", func(t *testing.T) {
		b, scheme := newV1beta2TestBuilder(t, &APIBuilder{})
		apiGroupInfo := genericapiserver.APIGroupInfo{VersionedResourcesStorageMap: map[string]map[string]rest.Storage{}}
		err := b.UpdateAPIGroupInfo(&apiGroupInfo, builder.APIGroupOptions{Scheme: scheme, OptsGetter: plainOptsGetter{}})
		require.ErrorContains(t, err, "requires unified storage")
		assert.Empty(t, apiGroupInfo.VersionedResourcesStorageMap)
	})

	t.Run("keeps the v0alpha1 resources of the group", func(t *testing.T) {
		assert.Equal(t, []string{builder.AllResourcesAllowed}, newV1beta2APIBuilder(&APIBuilder{}).AllowedV0Alpha1Resources())
	})

	t.Run("selects repositories by connection", func(t *testing.T) {
		_, fields, err := v1beta2RepositoryGetAttrs(testV1beta2Repository())
		require.NoError(t, err)
		assert.Equal(t, "my-connection", fields["spec.connection.name"])
		assert.Equal(t, "repo", fields["metadata.name"])

		_, _, err = v1beta2RepositoryGetAttrs(&provisioning.Repository{})
		require.Error(t, err)
	})

	t.Run("allows service identities", func(t *testing.T) {
		ctx, _ := identity.WithServiceIdentity(context.Background(), 1)
		decision, _, err := newV1beta2APIBuilder(&APIBuilder{}).GetAuthorizer().Authorize(ctx, authorizer.AttributesRecord{Resource: "repositories"})
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})
}

type plainOptsGetter struct{}

func (plainOptsGetter) GetRESTOptions(schema.GroupResource, runtime.Object) (generic.RESTOptions, error) {
	return generic.RESTOptions{}, nil
}
