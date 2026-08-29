package appplugin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var testAdmissionGVK = schema.GroupVersionKind{Group: "test-app", Version: "v0alpha1", Kind: "TestKind"}
var testAdmissionGVR = testAdmissionGVK.GroupVersion().WithResource("testkinds")

// countingReviewClient allows every review and counts the calls, which is what
// dispatch is measured in.
type countingReviewClient struct {
	pluginv3.AdmissionServiceClient
	call int
}

func (c *countingReviewClient) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest, ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	c.call++
	rsp := &pluginv3.AdmissionReviewResponse{}
	rsp.SetAllowed(true)
	return rsp, nil
}

func admissionObject() *unstructured.Unstructured {
	u := &unstructured.Unstructured{Object: map[string]any{"spec": map[string]any{"title": "before"}}}
	u.SetGroupVersionKind(testAdmissionGVK)
	u.SetName("thing-1")
	u.SetNamespace("default")
	return u
}

func admissionAttributes(op admission.Operation, subresource string) admission.Attributes {
	var obj runtime.Object = admissionObject()
	return admission.NewAttributesRecord(obj, nil, testAdmissionGVK, "default", "thing-1",
		testAdmissionGVR, subresource, op, nil, false, nil)
}

// The builder routes admission to the kind a request targets, or to nothing.
// What each kind then does with the review is the kind store's own business.
func TestBuilderAdmissionDispatch(t *testing.T) {
	client := &countingReviewClient{}

	scheme := runtime.NewScheme()
	scheme.AddKnownTypeWithName(testAdmissionGVK, &unstructured.Unstructured{})
	scheme.AddKnownTypeWithName(testAdmissionGVK.GroupVersion().WithKind("TestKindList"), &unstructured.UnstructuredList{})
	store, err := kindstore.New(testAdmissionGVK, app.ManifestVersionKind{
		Kind: "TestKind", Plural: "testkinds", Scope: "Namespaced",
		Admission: &app.AdmissionCapabilities{
			Mutation:   &app.MutationCapability{Operations: []app.AdmissionOperation{app.AdmissionOperationAny}},
			Validation: &app.ValidationCapability{Operations: []app.AdmissionOperation{app.AdmissionOperationAny}},
		},
	}, client, kindstore.Options{
		Scheme:              scheme,
		OptsGetter:          apistore.NewRESTOptionsGetterForClient(nil, nil, storagebackend.Config{}, nil, nil),
		StorageOptsRegister: func(schema.GroupResource, apistore.StorageOptions) {},
	}, nil)
	require.NoError(t, err)

	b := &AppPluginAPIBuilder{kinds: map[schema.GroupVersionResource]*kindstore.Store{
		testAdmissionGVR: store,
	}}
	ctx := context.Background()

	// One AdmissionReview answers both halves, so declaring both capabilities must
	// not double the plugin traffic on every write.
	require.NoError(t, b.Mutate(ctx, admissionAttributes(admission.Create, ""), nil))
	require.NoError(t, b.Validate(ctx, admissionAttributes(admission.Create, ""), nil))
	require.Equal(t, 1, client.call)

	// The v3 request cannot say which subresource was written, so a status write
	// would look to the plugin like a write to the main resource.
	require.NoError(t, b.Mutate(ctx, admissionAttributes(admission.Update, "status"), nil))
	require.NoError(t, b.Validate(ctx, admissionAttributes(admission.Update, "status"), nil))
	require.Equal(t, 1, client.call)

	// Resources of this group that are not manifest kinds (the settings resource)
	// have no hook to call.
	other := admission.NewAttributesRecord(admissionObject(), nil, testAdmissionGVK, "default", "thing-1",
		testAdmissionGVK.GroupVersion().WithResource("app"), "", admission.Create, nil, false, nil)
	require.NoError(t, b.Mutate(ctx, other, nil))
	require.NoError(t, b.Validate(ctx, other, nil))
	require.Equal(t, 1, client.call)
}
