package appinstaller

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
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

func (f fakeGetter) Get(_ context.Context, _ schema.GroupVersionResource, _, _ string) (runtime.Object, error) {
	return f.obj, f.err
}

// gvrCheckingGetter mirrors the real DashboardsAPIBuilder.Get: it serves only the resource
// it was built to expect, and returns NotFound for anything else - the shape a Getter must
// take to avoid the dashboards-vs-variables confusion when a GroupVersion serves multiple
// distinct top-level resources.
type gvrCheckingGetter struct {
	expected schema.GroupVersionResource
	obj      runtime.Object
}

func (g gvrCheckingGetter) Get(_ context.Context, gvr schema.GroupVersionResource, _, name string) (runtime.Object, error) {
	if gvr.Resource != g.expected.Resource {
		return nil, apierrors.NewNotFound(gvr.GroupResource(), name)
	}
	return g.obj, nil
}

// handlesOnlyChain implements only admission.Interface (Handles), not MutationInterface or
// ValidationInterface - exercising the case where the wrapped chain can't be dispatched at
// all, so Admit/Validate must still strip a client-supplied marker on their own, before ever
// attempting the type assertion that will fail.
type handlesOnlyChain struct{}

func (handlesOnlyChain) Handles(admission.Operation) bool { return true }

// handlesFalseChain reports Handles(operation) == false for every operation, unlike
// recordingChain (always true) or handlesOnlyChain (always true). It exercises the case where
// the wrapped chain declines an operation entirely - overwriteAdmission.Handles must still
// report true so the apiserver always calls Admit/Validate on the wrapper and the
// unconditional marker strip always runs, regardless of what the inner chain declares.
type handlesFalseChain struct {
	admitCalls, validateCalls []admission.Attributes
}

func (c *handlesFalseChain) Handles(admission.Operation) bool { return false }

func (c *handlesFalseChain) Admit(_ context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	c.admitCalls = append(c.admitCalls, a)
	return nil
}

func (c *handlesFalseChain) Validate(_ context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	c.validateCalls = append(c.validateCalls, a)
	return nil
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

// TestOverwriteAdmission_ChainWithoutInterfacesStillStripsMarker guards Finding 1: the
// marker strip must happen before the type assertion to MutationInterface/ValidationInterface,
// not inside rewrite() which is only reached if that assertion succeeds. A client-forged
// marker must never survive even when the wrapped chain can't be dispatched at all.
func TestOverwriteAdmission_ChainWithoutInterfacesStillStripsMarker(t *testing.T) {
	wrapper := newOverwriteAdmission(handlesOnlyChain{}, map[schema.GroupVersion]builder.APIGroupGetter{})

	obj := newUnstructuredWithRV("") // non-sentinel: forging the marker is the only thing under test
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetAnnotation(utils.AnnoKeyOverwriteValidated, "true") // a client trying to forge the marker

	admitAttrs := newAttrs(obj, admission.Create)
	require.NoError(t, wrapper.Admit(context.Background(), admitAttrs, nil))
	admitMeta, err := utils.MetaAccessor(admitAttrs.GetObject())
	require.NoError(t, err)
	require.Equal(t, "", admitMeta.GetAnnotation(utils.AnnoKeyOverwriteValidated),
		"Admit must strip the marker even though the chain doesn't implement MutationInterface")

	obj2 := newUnstructuredWithRV("")
	meta2, err := utils.MetaAccessor(obj2)
	require.NoError(t, err)
	meta2.SetAnnotation(utils.AnnoKeyOverwriteValidated, "true")

	validateAttrs := newAttrs(obj2, admission.Create)
	require.NoError(t, wrapper.Validate(context.Background(), validateAttrs, nil))
	validateMeta, err := utils.MetaAccessor(validateAttrs.GetObject())
	require.NoError(t, err)
	require.Equal(t, "", validateMeta.GetAnnotation(utils.AnnoKeyOverwriteValidated),
		"Validate must strip the marker even though the chain doesn't implement ValidationInterface")
}

// TestOverwriteAdmission_GVRMismatchIsNoOpPassthrough guards Finding 2: getters are keyed by
// GroupVersion only, but a GroupVersion can serve multiple distinct top-level resources
// (e.g. dashboards and variables under the same GV). A sentinel-triggered Create for a
// resource the registered Getter doesn't actually serve must fall back to an unchanged
// Create passthrough, not incorrectly fetch/validate against an unrelated resource.
func TestOverwriteAdmission_GVRMismatchIsNoOpPassthrough(t *testing.T) {
	dashboardGVR := schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v1", Resource: "dashboards"}
	variableGVR := schema.GroupVersionResource{Group: "dashboard.grafana.app", Version: "v1", Resource: "variables"}
	require.Equal(t, dashboardGVR.GroupVersion(), variableGVR.GroupVersion(), "the two resources must share one GV to reproduce the keyed-by-GV confusion")

	chain := &recordingChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{
		dashboardGVR.GroupVersion(): gvrCheckingGetter{expected: dashboardGVR, obj: newUnstructuredWithRV("")},
	})

	obj := newUnstructuredWithRV(apistore.OverwriteOnCreateResourceVersion)
	a := admission.NewAttributesRecord(
		obj, nil, testKind, "ns", "existing-name", variableGVR, "",
		admission.Create, &metav1.CreateOptions{}, false, &user.DefaultInfo{Name: "tester"},
	)
	require.NoError(t, wrapper.Validate(context.Background(), a, nil))

	require.Len(t, chain.validateCalls, 1)
	require.Equal(t, admission.Create, chain.validateCalls[0].GetOperation(),
		"a GVR the registered Getter doesn't actually serve must fall back to unchanged Create passthrough")
	require.Same(t, a, chain.validateCalls[0], "must be the original Attributes, not a synthetic rewrite")
}

// TestOverwriteAdmission_HandlesIsAlwaysTrue guards against a fail-open bypass: the real
// apiserver only calls Admit/Validate on an admission.Interface when Handles(operation)
// returns true for that operation. overwriteAdmission.Admit/Validate start with an
// unconditional strip of any client-supplied marker annotation - but if Handles merely
// delegated to the wrapped chain, and that chain happened to report Handles(Create) == false
// for some GV, the apiserver would skip calling Admit/Validate on this wrapper entirely,
// so the strip would never run and a client-forged marker could flow straight through to
// storage. Handles must therefore report true unconditionally, regardless of what the
// wrapped chain declares.
func TestOverwriteAdmission_HandlesIsAlwaysTrue(t *testing.T) {
	chain := &handlesFalseChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{})

	require.False(t, chain.Handles(admission.Create), "the fake must actually decline Create, or this test proves nothing")
	require.True(t, wrapper.Handles(admission.Create),
		"overwriteAdmission.Handles must not delegate to the wrapped chain - the apiserver would skip Admit/Validate entirely otherwise")
}

// TestOverwriteAdmission_MarkerStrippedEvenWhenChainDeclinesHandles proves the practical
// consequence of the fix above: a client-forged marker is stripped by Admit/Validate even
// when routed through a chain that reports Handles(Create) == false. Handles reporting true
// is what makes the apiserver call Admit/Validate at all in that situation - this test
// exercises Admit/Validate directly (as the apiserver would, now that Handles permits it) to
// confirm the strip itself is unconditional too.
func TestOverwriteAdmission_MarkerStrippedEvenWhenChainDeclinesHandles(t *testing.T) {
	chain := &handlesFalseChain{}
	wrapper := newOverwriteAdmission(chain, map[schema.GroupVersion]builder.APIGroupGetter{})
	require.True(t, wrapper.Handles(admission.Create), "precondition: the apiserver must be willing to call Admit/Validate")

	obj := newUnstructuredWithRV("") // non-sentinel: forging the marker is the only thing under test
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
	require.Equal(t, "", dispatchedMeta.GetAnnotation(utils.AnnoKeyOverwriteValidated),
		"a client-supplied marker must never reach the chain, even when the chain itself reports Handles == false")
}
