package kindstore

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/warning"

	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

var testAdmissionGVK = schema.GroupVersionKind{Group: "test-app", Version: "v0alpha1", Kind: "TestKind"}
var testAdmissionGVR = testAdmissionGVK.GroupVersion().WithResource("testkinds")

// reviewClient answers AdmissionReview with a canned response and records the request.
type reviewClient struct {
	pluginv3.AdmissionServiceClient
	req  *pluginv3.AdmissionReviewRequest
	rsp  *pluginv3.AdmissionReviewResponse
	err  error
	call int
}

func (c *reviewClient) AdmissionReview(_ context.Context, req *pluginv3.AdmissionReviewRequest, _ ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	c.call++
	c.req = req
	return c.rsp, c.err
}

func allowed(objectBytes []byte, warnings ...string) *pluginv3.AdmissionReviewResponse {
	rsp := &pluginv3.AdmissionReviewResponse{}
	rsp.SetAllowed(true)
	if objectBytes != nil {
		rsp.SetObjectBytes(objectBytes)
	}
	if len(warnings) > 0 {
		rsp.SetWarnings(warnings)
	}
	return rsp
}

func admissionTestStore(client pluginv3.AdmissionServiceClient, mutation, validation []app.AdmissionOperation) *Store {
	return &Store{
		gvk:        testAdmissionGVK,
		admission:  client,
		mutation:   newAdmissionOps(mutation),
		validation: newAdmissionOps(validation),
	}
}

func testObject() *unstructured.Unstructured {
	u := &unstructured.Unstructured{Object: map[string]any{
		"spec": map[string]any{"title": "before"},
	}}
	u.SetGroupVersionKind(testAdmissionGVK)
	u.SetName("thing-1")
	u.SetNamespace("default")
	u.SetResourceVersion("42")
	u.SetUID("abc-123")
	return u
}

func attributes(obj, old *unstructured.Unstructured, op admission.Operation, subresource string) admission.Attributes {
	// A typed nil pointer is not a nil runtime.Object, so leave the interface unset
	// instead of handing admission a non-nil object with nothing in it.
	var newObj, oldObj runtime.Object
	if obj != nil {
		newObj = obj
	}
	if old != nil {
		oldObj = old
	}
	return admission.NewAttributesRecord(newObj, oldObj, testAdmissionGVK, "default", "thing-1",
		testAdmissionGVR, subresource, op, nil, false, nil)
}

func TestNewAdmissionOps(t *testing.T) {
	require.Nil(t, newAdmissionOps(nil))

	// CONNECT cannot be reviewed, so a kind declaring only it declares nothing.
	require.Nil(t, newAdmissionOps([]app.AdmissionOperation{app.AdmissionOperationConnect}))

	// ANY is the three operations the v3 request can express; CONNECT has to be
	// declared on its own.
	require.Equal(t, admissionOps{
		admission.Create: true,
		admission.Update: true,
		admission.Delete: true,
	}, newAdmissionOps([]app.AdmissionOperation{app.AdmissionOperationAny}))

	require.Equal(t, admissionOps{admission.Create: true},
		newAdmissionOps([]app.AdmissionOperation{app.AdmissionOperationCreate}))
}

// A kind that declares no admission capability must never reach the plugin.
func TestAdmissionNotDeclared(t *testing.T) {
	client := &reviewClient{rsp: allowed(nil)}
	s := admissionTestStore(client, nil, nil)

	obj := testObject()
	require.NoError(t, s.MutateAdmission(context.Background(), attributes(obj, nil, admission.Create, "")))
	require.NoError(t, s.ValidateAdmission(context.Background(), attributes(obj, nil, admission.Create, "")))
	require.Zero(t, client.call)
}

// Capabilities are per operation: an UPDATE-only hook must not fire on create.
func TestAdmissionOnlyDeclaredOperations(t *testing.T) {
	client := &reviewClient{rsp: allowed(nil)}
	s := admissionTestStore(client,
		[]app.AdmissionOperation{app.AdmissionOperationUpdate},
		[]app.AdmissionOperation{app.AdmissionOperationDelete})

	obj := testObject()
	require.NoError(t, s.MutateAdmission(context.Background(), attributes(obj, nil, admission.Create, "")))
	require.NoError(t, s.ValidateAdmission(context.Background(), attributes(obj, nil, admission.Create, "")))
	require.Zero(t, client.call)

	require.NoError(t, s.MutateAdmission(context.Background(), attributes(obj, testObject(), admission.Update, "")))
	require.Equal(t, 1, client.call)
	require.Equal(t, pluginv3.AdmissionReviewRequest_OPERATION_UPDATE, client.req.GetOperation())

	require.NoError(t, s.ValidateAdmission(context.Background(), attributes(nil, testObject(), admission.Delete, "")))
	require.Equal(t, 2, client.call)
	require.Equal(t, pluginv3.AdmissionReviewRequest_OPERATION_DELETE, client.req.GetOperation())
}

func TestAdmissionRequestPayload(t *testing.T) {
	t.Run("create sends only the incoming object", func(t *testing.T) {
		client := &reviewClient{rsp: allowed(nil)}
		s := admissionTestStore(client, []app.AdmissionOperation{app.AdmissionOperationAny}, nil)

		require.NoError(t, s.MutateAdmission(context.Background(),
			attributes(testObject(), nil, admission.Create, "")))

		require.Equal(t, pluginv3.AdmissionReviewRequest_OPERATION_CREATE, client.req.GetOperation())
		require.Equal(t, testAdmissionGVK.Group, client.req.GetKind().GetGroup())
		require.Equal(t, testAdmissionGVK.Version, client.req.GetKind().GetVersion())
		require.Equal(t, testAdmissionGVK.Kind, client.req.GetKind().GetKind())
		require.NotEmpty(t, client.req.GetObjectBytes())
		require.Empty(t, client.req.GetOldObjectBytes())

		// The plugin needs the full metadata envelope, not just the spec.
		sent := map[string]any{}
		require.NoError(t, json.Unmarshal(client.req.GetObjectBytes(), &sent))
		require.Equal(t, "TestKind", sent["kind"])
		require.Equal(t, "thing-1", sent["metadata"].(map[string]any)["name"])
	})

	// Delete carries no incoming object; without the stored one the hook has nothing to judge.
	t.Run("delete sends only the stored object", func(t *testing.T) {
		client := &reviewClient{rsp: allowed(nil)}
		s := admissionTestStore(client, nil, []app.AdmissionOperation{app.AdmissionOperationAny})

		require.NoError(t, s.ValidateAdmission(context.Background(),
			attributes(nil, testObject(), admission.Delete, "")))

		require.Empty(t, client.req.GetObjectBytes())
		require.NotEmpty(t, client.req.GetOldObjectBytes())
	})
}

func TestMutatingAdmission(t *testing.T) {
	t.Run("an empty response leaves the object alone", func(t *testing.T) {
		s := admissionTestStore(&reviewClient{rsp: allowed(nil)},
			[]app.AdmissionOperation{app.AdmissionOperationAny}, nil)

		obj := testObject()
		require.NoError(t, s.MutateAdmission(context.Background(), attributes(obj, nil, admission.Create, "")))
		require.Equal(t, testObject(), obj)
	})

	t.Run("the mutated object replaces the request body", func(t *testing.T) {
		mutated := testObject()
		mutated.Object["spec"] = map[string]any{"title": "after", "added": "yes"}
		raw, err := json.Marshal(mutated)
		require.NoError(t, err)

		s := admissionTestStore(&reviewClient{rsp: allowed(raw)},
			[]app.AdmissionOperation{app.AdmissionOperationAny}, nil)

		obj := testObject()
		require.NoError(t, s.MutateAdmission(context.Background(), attributes(obj, nil, admission.Create, "")))
		require.Equal(t, map[string]any{"title": "after", "added": "yes"}, obj.Object["spec"])
	})

	// The request path and storage key are already fixed, so a hook that renames or
	// re-kinds the object would write it under a key that no longer matches.
	t.Run("identity survives a hook that rewrites it", func(t *testing.T) {
		mutated := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{"title": "after"},
		}}
		mutated.SetGroupVersionKind(schema.GroupVersionKind{Group: "other", Version: "v1", Kind: "Other"})
		mutated.SetName("hijacked")
		mutated.SetNamespace("other-ns")
		mutated.SetUID("999")
		mutated.SetResourceVersion("1")
		raw, err := json.Marshal(mutated)
		require.NoError(t, err)

		s := admissionTestStore(&reviewClient{rsp: allowed(raw)},
			[]app.AdmissionOperation{app.AdmissionOperationAny}, nil)

		obj := testObject()
		require.NoError(t, s.MutateAdmission(context.Background(), attributes(obj, nil, admission.Create, "")))

		require.Equal(t, testAdmissionGVK, obj.GroupVersionKind())
		require.Equal(t, "thing-1", obj.GetName())
		require.Equal(t, "default", obj.GetNamespace())
		require.EqualValues(t, "abc-123", obj.GetUID())
		require.Equal(t, "42", obj.GetResourceVersion())
		require.Equal(t, map[string]any{"title": "after"}, obj.Object["spec"])
	})

	// On an update the generic handler writes managedFields before mutating
	// admission runs, so a hook that returns a rebuilt object rather than an
	// edited one would drop the ownership the request just recorded -- and
	// nothing downstream puts it back.
	t.Run("managedFields survive a hook that drops them", func(t *testing.T) {
		mutated := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{"title": "after"},
		}}
		raw, err := json.Marshal(mutated)
		require.NoError(t, err)

		s := admissionTestStore(&reviewClient{rsp: allowed(raw)},
			[]app.AdmissionOperation{app.AdmissionOperationAny}, nil)

		obj := testObject()
		entries := []metav1.ManagedFieldsEntry{{
			Manager:    "kubectl",
			Operation:  metav1.ManagedFieldsOperationUpdate,
			APIVersion: testAdmissionGVK.GroupVersion().String(),
			FieldsType: "FieldsV1",
			FieldsV1:   &metav1.FieldsV1{Raw: []byte(`{"f:spec":{}}`)},
		}}
		obj.SetManagedFields(entries)

		require.NoError(t, s.MutateAdmission(context.Background(),
			attributes(obj, testObject(), admission.Update, "")))
		require.Equal(t, entries, obj.GetManagedFields())
	})

	// A hook that does return managedFields does not get to invent ownership.
	t.Run("managedFields cannot be rewritten by a hook", func(t *testing.T) {
		mutated := &unstructured.Unstructured{Object: map[string]any{
			"spec": map[string]any{"title": "after"},
		}}
		mutated.SetManagedFields([]metav1.ManagedFieldsEntry{{
			Manager:    "the-plugin",
			Operation:  metav1.ManagedFieldsOperationApply,
			APIVersion: testAdmissionGVK.GroupVersion().String(),
		}})
		raw, err := json.Marshal(mutated)
		require.NoError(t, err)

		s := admissionTestStore(&reviewClient{rsp: allowed(raw)},
			[]app.AdmissionOperation{app.AdmissionOperationAny}, nil)

		obj := testObject()
		require.NoError(t, s.MutateAdmission(context.Background(),
			attributes(obj, testObject(), admission.Update, "")))
		require.Empty(t, obj.GetManagedFields())
	})

	t.Run("an unparsable response fails the request", func(t *testing.T) {
		s := admissionTestStore(&reviewClient{rsp: allowed([]byte("not json"))},
			[]app.AdmissionOperation{app.AdmissionOperationAny}, nil)

		err := s.MutateAdmission(context.Background(), attributes(testObject(), nil, admission.Create, ""))
		require.True(t, apierrors.IsInternalError(err), "got %v", err)
	})
}

func TestAdmissionDenial(t *testing.T) {
	t.Run("a bare denial is reported as forbidden", func(t *testing.T) {
		rsp := &pluginv3.AdmissionReviewResponse{}
		rsp.SetAllowed(false)
		s := admissionTestStore(&reviewClient{rsp: rsp}, nil, []app.AdmissionOperation{app.AdmissionOperationAny})

		err := s.ValidateAdmission(context.Background(), attributes(testObject(), nil, admission.Create, ""))
		require.True(t, apierrors.IsForbidden(err), "got %v", err)
		require.Contains(t, err.Error(), "TestKind")
	})

	t.Run("the plugin status drives the reported error", func(t *testing.T) {
		cause := &pluginv3.StatusCause{}
		cause.SetReason("FieldValueRequired")
		cause.SetMessage("title is required")
		cause.SetField("spec.title")

		details := &pluginv3.StatusDetails{}
		details.SetName("thing-1")
		details.SetKind("TestKind")
		details.SetCauses([]*pluginv3.StatusCause{cause})

		status := &pluginv3.StatusResult{}
		status.SetMessage("title is required")
		status.SetReason(string(metav1.StatusReasonInvalid))
		status.SetCode(422)
		status.SetDetails(details)

		rsp := &pluginv3.AdmissionReviewResponse{}
		rsp.SetAllowed(false)
		rsp.SetError(status)

		s := admissionTestStore(&reviewClient{rsp: rsp}, nil, []app.AdmissionOperation{app.AdmissionOperationAny})
		err := s.ValidateAdmission(context.Background(), attributes(testObject(), nil, admission.Create, ""))

		require.True(t, apierrors.IsInvalid(err), "got %v", err)
		require.Contains(t, err.Error(), "title is required")

		var status2 apierrors.APIStatus
		require.True(t, errors.As(err, &status2))
		require.EqualValues(t, 422, status2.Status().Code)
		require.Len(t, status2.Status().Details.Causes, 1)
		require.Equal(t, "spec.title", status2.Status().Details.Causes[0].Field)
	})

	// Whatever the plugin says, a denied request cannot come back looking like it
	// succeeded or was redirected.
	t.Run("a sub-400 code is raised", func(t *testing.T) {
		for _, code := range []int32{200, 302, 399} {
			status := &pluginv3.StatusResult{}
			status.SetMessage("nope")
			status.SetCode(code)
			rsp := &pluginv3.AdmissionReviewResponse{}
			rsp.SetAllowed(false)
			rsp.SetError(status)

			s := admissionTestStore(&reviewClient{rsp: rsp}, nil, []app.AdmissionOperation{app.AdmissionOperationAny})
			err := s.ValidateAdmission(context.Background(), attributes(testObject(), nil, admission.Create, ""))

			var apiStatus apierrors.APIStatus
			require.True(t, errors.As(err, &apiStatus))
			require.EqualValues(t, 400, apiStatus.Status().Code, "code %d", code)
		}
	})

	// The proto documents `error` as a failure to evaluate, so it denies even if
	// the plugin also left `allowed` set.
	t.Run("an error alongside allowed still denies", func(t *testing.T) {
		status := &pluginv3.StatusResult{}
		status.SetMessage("hook exploded")
		rsp := &pluginv3.AdmissionReviewResponse{}
		rsp.SetAllowed(true)
		rsp.SetError(status)

		s := admissionTestStore(&reviewClient{rsp: rsp}, nil, []app.AdmissionOperation{app.AdmissionOperationAny})
		err := s.ValidateAdmission(context.Background(), attributes(testObject(), nil, admission.Create, ""))
		require.Error(t, err)
		require.Contains(t, err.Error(), "hook exploded")
	})

	// A declared hook that cannot be reached must fail closed, not admit silently.
	t.Run("a transport failure fails the request", func(t *testing.T) {
		s := admissionTestStore(&reviewClient{err: errors.New("connection refused")},
			nil, []app.AdmissionOperation{app.AdmissionOperationAny})

		err := s.ValidateAdmission(context.Background(), attributes(testObject(), nil, admission.Create, ""))
		require.True(t, apierrors.IsInternalError(err), "got %v", err)
	})

	// clientWrapper reports a missing v3 backend as ServiceUnavailable; that reason
	// is more useful to the caller than a generic 500.
	t.Run("an API status error is passed through", func(t *testing.T) {
		s := admissionTestStore(&reviewClient{err: apierrors.NewServiceUnavailable("no v3 backend")},
			nil, []app.AdmissionOperation{app.AdmissionOperationAny})

		err := s.ValidateAdmission(context.Background(), attributes(testObject(), nil, admission.Create, ""))
		require.True(t, apierrors.IsServiceUnavailable(err), "got %v", err)
	})
}

func TestAdmissionWarnings(t *testing.T) {
	recorder := &warningRecorder{}
	ctx := warning.WithWarningRecorder(context.Background(), recorder)

	s := admissionTestStore(&reviewClient{rsp: allowed(nil, "deprecated field", "second")},
		nil, []app.AdmissionOperation{app.AdmissionOperationAny})

	require.NoError(t, s.ValidateAdmission(ctx, attributes(testObject(), nil, admission.Create, "")))
	require.Equal(t, []string{"deprecated field", "second"}, recorder.warnings)
}

type warningRecorder struct {
	warnings []string
}

func (r *warningRecorder) AddWarning(_, text string) {
	r.warnings = append(r.warnings, text)
}

// A kind declaring both capabilities is reviewed once, in the mutating phase, and
// that single response has to carry both outcomes.
func TestAdmissionSingleCallCoversBothCapabilities(t *testing.T) {
	both := []app.AdmissionOperation{app.AdmissionOperationAny}
	ctx := context.Background()

	t.Run("the one call mutates and admits", func(t *testing.T) {
		mutated := testObject()
		mutated.Object["spec"] = map[string]any{"title": "after"}
		raw, err := json.Marshal(mutated)
		require.NoError(t, err)

		client := &reviewClient{rsp: allowed(raw)}
		s := admissionTestStore(client, both, both)

		obj := testObject()
		require.NoError(t, s.MutateAdmission(ctx, attributes(obj, nil, admission.Create, "")))
		require.NoError(t, s.ValidateAdmission(ctx, attributes(obj, nil, admission.Create, "")))

		require.Equal(t, 1, client.call)
		require.Equal(t, map[string]any{"title": "after"}, obj.Object["spec"])
	})

	// A denial must surface even though it arrives during the mutating phase.
	t.Run("the one call can deny", func(t *testing.T) {
		rsp := &pluginv3.AdmissionReviewResponse{}
		rsp.SetAllowed(false)
		client := &reviewClient{rsp: rsp}
		s := admissionTestStore(client, both, both)

		err := s.MutateAdmission(ctx, attributes(testObject(), nil, admission.Create, ""))
		require.True(t, apierrors.IsForbidden(err), "got %v", err)
		require.Equal(t, 1, client.call)
	})

	// Capabilities are per operation: an operation only mutation covers still needs
	// the validating phase to make the call.
	t.Run("a validate-only operation still calls", func(t *testing.T) {
		client := &reviewClient{rsp: allowed(nil)}
		s := admissionTestStore(client,
			[]app.AdmissionOperation{app.AdmissionOperationCreate},
			[]app.AdmissionOperation{app.AdmissionOperationCreate, app.AdmissionOperationDelete})

		require.NoError(t, s.MutateAdmission(ctx, attributes(nil, testObject(), admission.Delete, "")))
		require.Zero(t, client.call)
		require.NoError(t, s.ValidateAdmission(ctx, attributes(nil, testObject(), admission.Delete, "")))
		require.Equal(t, 1, client.call)
	})
}

func TestNewAdmissionCapabilities(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v1alpha1", Kind: "TestKind"}
	client := &reviewClient{}

	newStore := func(t *testing.T, capabilities *app.AdmissionCapabilities) *Store {
		t.Helper()
		opts, _ := newStoreOpts(t, gvk)
		s, err := New(gvk, app.ManifestVersionKind{
			Kind: "TestKind", Plural: "testkinds", Scope: "Namespaced", Admission: capabilities,
		}, client, opts, nil)
		require.NoError(t, err)
		return s
	}

	t.Run("no admission block leaves both hooks off", func(t *testing.T) {
		s := newStore(t, nil)
		require.Nil(t, s.mutation)
		require.Nil(t, s.validation)
	})

	// An empty operations list is documented as equivalent to no capability.
	t.Run("empty operations leave the hook off", func(t *testing.T) {
		s := newStore(t, &app.AdmissionCapabilities{
			Mutation:   &app.MutationCapability{},
			Validation: &app.ValidationCapability{Operations: []app.AdmissionOperation{}},
		})
		require.Nil(t, s.mutation)
		require.Nil(t, s.validation)
	})

	t.Run("declared operations are wired per capability", func(t *testing.T) {
		s := newStore(t, &app.AdmissionCapabilities{
			Mutation: &app.MutationCapability{Operations: []app.AdmissionOperation{
				app.AdmissionOperationCreate,
			}},
			Validation: &app.ValidationCapability{Operations: []app.AdmissionOperation{
				app.AdmissionOperationCreate, app.AdmissionOperationUpdate,
			}},
		})
		require.Equal(t, admissionOps{admission.Create: true}, s.mutation)
		require.Equal(t, admissionOps{admission.Create: true, admission.Update: true}, s.validation)
	})
}

// A declared hook fails closed, so a builder without a plugin client would reject
// every write to the kind. Catch it while the API group is being built.
func TestNewRequiresClientForAdmission(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v1alpha1", Kind: "TestKind"}
	kind := app.ManifestVersionKind{
		Kind: "TestKind", Plural: "testkinds", Scope: "Namespaced",
		Admission: &app.AdmissionCapabilities{
			Validation: &app.ValidationCapability{Operations: []app.AdmissionOperation{
				app.AdmissionOperationCreate,
			}},
		},
	}

	opts, _ := newStoreOpts(t, gvk)
	_, err := New(gvk, kind, nil, opts, nil)
	require.ErrorContains(t, err, "no plugin client")

	// An admission block that declares nothing needs no client.
	kind.Admission = &app.AdmissionCapabilities{Validation: &app.ValidationCapability{}}
	opts, _ = newStoreOpts(t, gvk)
	_, err = New(gvk, kind, nil, opts, nil)
	require.NoError(t, err)
}
