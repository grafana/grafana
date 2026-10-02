package appinstaller

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var testGV = schema.GroupVersionResource{Group: "example.grafana.app", Version: "v1", Resource: "things"}
var testKind = schema.GroupVersionKind{Group: "example.grafana.app", Version: "v1", Kind: "Thing"}

type fakeGetter struct {
	obj runtime.Object
	err error
}

func (f fakeGetter) Get(_ context.Context, _, _ string) (runtime.Object, error) {
	return f.obj, f.err
}

// recordingChain records every Attributes it's called with, so tests can assert exactly
// what the wrapper dispatched downstream - the operation, and whether OldObject was set.
type recordingChain struct {
	admitCalls, validateCalls []admission.Attributes
	err                       error
}

func (r *recordingChain) Admit(_ context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	r.admitCalls = append(r.admitCalls, a)
	return r.err
}

func (r *recordingChain) Validate(_ context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	r.validateCalls = append(r.validateCalls, a)
	return r.err
}

func (r *recordingChain) Handles(admission.Operation) bool { return true }

func newUnstructuredWithRV(rv string) *unstructured.Unstructured {
	obj := &unstructured.Unstructured{Object: map[string]interface{}{}}
	obj.SetName("existing-name")
	obj.SetNamespace("ns")
	if rv != "" {
		obj.SetResourceVersion(rv)
	}
	return obj
}

func newAttrs(obj runtime.Object, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(obj, nil, testKind, "ns", "existing-name", testGV, "", op, &metav1.CreateOptions{}, false, &user.DefaultInfo{Name: "tester"})
}

func TestOverwriteAdmission_NonSentinelPassesThroughUnchanged(t *testing.T) {
	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{
		testGV.GroupVersion(): fakeGetter{obj: newUnstructuredWithRV("")},
	})

	obj := newUnstructuredWithRV("")
	a := newAttrs(obj, admission.Create)
	require.NoError(t, wrapper.Validate(context.Background(), a, nil))

	require.Len(t, chain.validateCalls, 1)
	require.Same(t, a, chain.validateCalls[0], "a non-sentinel request must reach the chain completely unchanged")
}

func TestOverwriteAdmission_NoGetterRegisteredPassesThroughUnchanged(t *testing.T) {
	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{})

	obj := newUnstructuredWithRV(apistore.OverwriteOnCreateResourceVersion)
	a := newAttrs(obj, admission.Create)
	require.NoError(t, wrapper.Validate(context.Background(), a, nil))

	require.Len(t, chain.validateCalls, 1)
	require.Equal(t, admission.Create, chain.validateCalls[0].GetOperation(), "a GV with no registered Getter must dispatch unchanged, still as Create")
}

func TestOverwriteAdmission_SentinelWithGetterRewritesToUpdate(t *testing.T) {
	existing := newUnstructuredWithRV("")
	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{
		testGV.GroupVersion(): fakeGetter{obj: existing},
	})

	obj := newUnstructuredWithRV(apistore.OverwriteOnCreateResourceVersion)
	a := newAttrs(obj, admission.Create)
	require.NoError(t, wrapper.Validate(context.Background(), a, nil))

	require.Len(t, chain.validateCalls, 1)
	dispatched := chain.validateCalls[0]
	require.Equal(t, admission.Update, dispatched.GetOperation(), "must be re-dispatched as a real Update")
	require.Same(t, existing, dispatched.GetOldObject(), "must carry the real existing object as OldObject")

	dispatchedObj, ok := dispatched.GetObject().(*unstructured.Unstructured)
	require.True(t, ok)
	meta, err := utils.MetaAccessor(dispatchedObj)
	require.NoError(t, err)
	require.Equal(t, "true", meta.GetAnnotation(utils.AnnoKeyOverwriteValidated), "a successful synthetic re-dispatch must stamp the marker")
}

func TestOverwriteAdmission_ClientSuppliedMarkerIsAlwaysStripped(t *testing.T) {
	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{})

	obj := newUnstructuredWithRV("") // non-sentinel: this GV path doesn't even need a Getter
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "true") // a client trying to forge the marker

	a := newAttrs(obj, admission.Create)
	require.NoError(t, wrapper.Admit(context.Background(), a, nil))

	require.Len(t, chain.admitCalls, 1)
	dispatchedObj, ok := chain.admitCalls[0].GetObject().(*unstructured.Unstructured)
	require.True(t, ok)
	dispatchedMeta, err := utils.MetaAccessor(dispatchedObj)
	require.NoError(t, err)
	require.Equal(t, "", dispatchedMeta.GetAnnotation(utils.AnnoKeyOverwriteValidated), "a client-supplied marker must never reach the chain, under any circumstance")
}

func TestOverwriteAdmission_GetterErrorPropagatesUnchanged(t *testing.T) {
	boom := fakeGetter{err: errTestGetterFailure}
	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{
		testGV.GroupVersion(): boom,
	})

	obj := newUnstructuredWithRV(apistore.OverwriteOnCreateResourceVersion)
	a := newAttrs(obj, admission.Create)
	err := wrapper.Validate(context.Background(), a, nil)
	require.ErrorIs(t, err, errTestGetterFailure)
	require.Empty(t, chain.validateCalls, "the chain must never be reached if the Getter itself errors")
}

var errTestGetterFailure = errors.New("boom: fake getter failure")
