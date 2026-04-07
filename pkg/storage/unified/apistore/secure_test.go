package apistore

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// fakeSecureValueSupport is a hand-written fake for contracts.InlineSecureValueSupport.
type fakeSecureValueSupport struct {
	// createInlineResults maps RawSecureValue to the return value.
	createInlineResults map[common.RawSecureValue]struct {
		name string
		err  error
	}
	createInlineCalls int

	// deleteResults is a queue of errors to return from DeleteWhenOwnedByResource.
	deleteResults []error
	deleteCalls   int
}

func (f *fakeSecureValueSupport) CanReference(_ context.Context, _ common.ObjectReference, _ ...string) error {
	return fmt.Errorf("CanReference: not expected")
}

func (f *fakeSecureValueSupport) CreateInline(_ context.Context, _ common.ObjectReference, value common.RawSecureValue, _ *string) (string, error) {
	f.createInlineCalls++
	if result, ok := f.createInlineResults[value]; ok {
		return result.name, result.err
	}
	return "", fmt.Errorf("CreateInline: unexpected value %q", string(value))
}

func (f *fakeSecureValueSupport) DeleteWhenOwnedByResource(_ context.Context, _ common.ObjectReference, _ ...string) error {
	if f.deleteCalls < len(f.deleteResults) {
		err := f.deleteResults[f.deleteCalls]
		f.deleteCalls++
		return err
	}
	f.deleteCalls++
	return fmt.Errorf("DeleteWhenOwnedByResource: unexpected call #%d", f.deleteCalls)
}

func TestSecureLifecycle(t *testing.T) {
	resourceWithSecureValues := func(sv common.InlineSecureValues) utils.GrafanaMetaAccessor {
		tmp := &unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "something.grafana.app/v1beta1",
				"kind":       "CustomKind",
				"metadata": map[string]any{
					"namespace": "default",
					"name":      "test",
				},
				"secure": sv,
			},
		}
		raw, err := tmp.MarshalJSON() // NOTE, any secret gets replaced with: [REDACTED]
		require.NoError(t, err)
		tmp.SetAnnotations(map[string]string{
			utils.AnnoKeyKubectlLastAppliedConfig: string(raw),
		})

		obj, err := utils.MetaAccessor(tmp)
		require.NoError(t, err)
		return obj
	}

	t.Run("create secure values", func(t *testing.T) {
		secureStore := &fakeSecureValueSupport{
			createInlineResults: map[common.RawSecureValue]struct {
				name string
				err  error
			}{
				"SecretAAA": {name: "NameForA"},
				"SecretBBB": {name: "NameForB"},
			},
		}

		info := &objectForStorage{}
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Create: "SecretAAA"},
			"b": common.InlineSecureValue{Create: "SecretBBB"},
		})

		err := prepareSecureValues(context.Background(), secureStore, obj, nil, info)
		require.NoError(t, err)
		require.True(t, info.hasChanged)
		slices.Sort(info.createdSecureValues) // keep a predictable order
		require.Equal(t, []string{"NameForA", "NameForB"}, info.createdSecureValues)
		secure, err := obj.GetSecureValues()
		require.NoError(t, err)
		require.JSONEq(t, `{
			"a": {"name": "NameForA"},
			"b": {"name": "NameForB"}
		}`, asJSON(secure, true))

		v := obj.GetAnnotation(utils.AnnoKeyKubectlLastAppliedConfig)
		require.Empty(t, v, "should exclude the last config with raw secrets")

		require.Equal(t, 2, secureStore.createInlineCalls)
	})

	t.Run("create secure values with errors", func(t *testing.T) {
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Create: "SecretAAA"},
			"b": common.InlineSecureValue{Create: "SecretBBB"},
		})

		info := &objectForStorage{}
		expectError := fmt.Errorf("expected error")
		secureStore := &fakeSecureValueSupport{
			createInlineResults: map[common.RawSecureValue]struct {
				name string
				err  error
			}{
				"SecretAAA": {err: expectError},
				"SecretBBB": {err: expectError},
			},
		}

		err := prepareSecureValues(context.Background(), secureStore, obj, nil, info)
		require.Error(t, err, "should error when secure value creation fails")
		require.Equal(t, expectError, err, "error should be propagated")
	})

	t.Run("change name manually", func(t *testing.T) {
		secureStore := &fakeSecureValueSupport{}

		info := &objectForStorage{}
		previous := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "111"},
			"b": common.InlineSecureValue{Name: "222"},
			"c": common.InlineSecureValue{Name: "333"},
		})
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "222"},
			"b": common.InlineSecureValue{Name: "333"}, // no change
			// "c" will be loaded from the previous object without changes
		})

		err := prepareSecureValues(context.Background(), secureStore, obj, previous, info)
		require.NoError(t, err)
		require.True(t, info.hasChanged)
		require.Empty(t, info.createdSecureValues)
		require.Equal(t, info.deleteSecureValues, []string{"111"}) // will be removed if storage succeeds
		secure, err := obj.GetSecureValues()
		require.NoError(t, err)
		require.JSONEq(t, `{
			"a": {"name": "222"},
			"b": {"name": "333"},
			"c": {"name": "333"}
		}`, asJSON(secure, true))
	})

	t.Run("update without secrets", func(t *testing.T) {
		secureStore := &fakeSecureValueSupport{}

		info := &objectForStorage{}
		previousObject := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "NameForA"},
			"b": common.InlineSecureValue{Name: "NameForB"},
		})
		objWithoutSecrets := resourceWithSecureValues(nil)

		// Note that the secure values from the previous object are copied over
		err := prepareSecureValues(context.Background(), secureStore, objWithoutSecrets, previousObject, info)
		require.NoError(t, err)
		require.False(t, info.hasChanged)
		secure, err := objWithoutSecrets.GetSecureValues()
		require.NoError(t, err)
		require.JSONEq(t, `{
			"a": {"name": "NameForA"},
			"b": {"name": "NameForB"}
		}`, asJSON(secure, true))
	})

	t.Run("remove secure values", func(t *testing.T) {
		secureStore := &fakeSecureValueSupport{
			deleteResults: []error{nil},
		}
		previous := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "NameForA"},
			"b": common.InlineSecureValue{Name: "NameForB"},
			"c": common.InlineSecureValue{Name: "NameForC"},
		})

		// Remove "b" with an explicit command
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "NameForA"}, // no change
			"b": common.InlineSecureValue{Remove: true},
			// "c" will be loaded from the previous object
		})

		// Prepare secure values does not change anything when removing
		info := &objectForStorage{}
		err := prepareSecureValues(context.Background(), secureStore, obj, previous, info)
		require.NoError(t, err)
		require.True(t, info.hasChanged) // value was removed
		require.Equal(t, 0, secureStore.createInlineCalls)
		require.Equal(t, 0, secureStore.deleteCalls)

		secure, err := obj.GetSecureValues()
		require.NoError(t, err)
		require.JSONEq(t, `{
			"a": {"name": "NameForA"},
			"c": {"name": "NameForC"}
		}`, asJSON(secure, true))

		v := obj.GetAnnotation(utils.AnnoKeyKubectlLastAppliedConfig)
		require.NotEmpty(t, v, "should keep the annotations when a raw secret is not exposed")

		// When there is not an error, the finish command will do a real delete
		err = info.finish(context.Background(), nil, secureStore)
		require.NoError(t, err)
		require.True(t, info.hasChanged) // value was removed
		require.Equal(t, 1, secureStore.deleteCalls)

		// When an error exists, no values will be deleted
		err = fmt.Errorf("expected error")
		outErr := info.finish(context.Background(), err, secureStore)
		require.Equal(t, err, outErr, "error should be passed through")
	})

	t.Run("remove invalid secure values", func(t *testing.T) {
		secureStore := &fakeSecureValueSupport{}
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"b": common.InlineSecureValue{Remove: true}, // b does not exist in previous value
		})

		// Previous values must exist for remove to execute
		info := &objectForStorage{}
		err := prepareSecureValues(context.Background(), secureStore, obj, resourceWithSecureValues(nil), info)
		require.Nil(t, err, "should noop when previous value does not exist")
		require.False(t, info.hasChanged, "noop remove should not mark the object as changed")
		secure, err := obj.GetSecureValues()
		require.NoError(t, err)
		require.Empty(t, secure, "noop remove should be stripped before the object is written")
		require.Equal(t, 0, secureStore.createInlineCalls)
		require.Equal(t, 0, secureStore.deleteCalls)
	})

	t.Run("remove invalid secure values while creating others", func(t *testing.T) {
		secureStore := &fakeSecureValueSupport{
			createInlineResults: map[common.RawSecureValue]struct {
				name string
				err  error
			}{
				"SecretAAA": {name: "NameForA"},
			},
		}

		obj := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Create: "SecretAAA"},
			"b": common.InlineSecureValue{Remove: true}, // b does not exist in previous value
		})

		info := &objectForStorage{}
		err := prepareSecureValues(context.Background(), secureStore, obj, resourceWithSecureValues(nil), info)
		require.NoError(t, err)
		require.True(t, info.hasChanged, "creating a secure value should still mark the object as changed")
		secure, err := obj.GetSecureValues()
		require.NoError(t, err)
		require.JSONEq(t, `{
			"a": {"name": "NameForA"}
		}`, asJSON(secure, true))
		require.Equal(t, 1, secureStore.createInlineCalls)
	})

	t.Run("delete resource", func(t *testing.T) {
		secureStore := &fakeSecureValueSupport{
			deleteResults: []error{nil},
		}
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "NameForA"},
		})
		sv, err := obj.GetSecureValues()
		require.NoError(t, err)
		require.Len(t, sv, 1)

		err = handleSecureValuesDelete(context.Background(), secureStore, obj)
		require.NoError(t, err)
		require.Equal(t, 1, secureStore.deleteCalls)
		sv, err = obj.GetSecureValues()
		require.NoError(t, err)
		require.Empty(t, sv, "secure values should be empty after delete")

		// Delete should propagate deletion errors
		obj = resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "NameForA"},
		})
		expectError := fmt.Errorf("expected error")
		secureStore = &fakeSecureValueSupport{
			deleteResults: []error{expectError},
		}
		err = handleSecureValuesDelete(context.Background(), secureStore, obj)
		require.Equal(t, expectError, err, "error should be passed through")
		require.Equal(t, 1, secureStore.deleteCalls)
	})

	t.Run("invalid states", func(t *testing.T) {
		secureStore := &fakeSecureValueSupport{}

		info := &objectForStorage{}
		err := prepareSecureValues(context.Background(), secureStore, resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{}, // MUST have Create, Remove or Name
		}), nil, info)
		require.Error(t, err)
	})

	t.Run("setup errors", func(t *testing.T) {
		objWithoutSecrets := resourceWithSecureValues(nil)
		objWithCreateSecret := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Create: "SecretAAA"},
		})
		invalid, _ := utils.MetaAccessor(&unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "something.grafana.app/v1beta1",
				"kind":       "CustomKind",
				"metadata": map[string]any{
					"namespace": "default",
					"name":      "test",
				},
				"secure": t, // something NOT a secure value
			},
		})
		info := &objectForStorage{}
		err := prepareSecureValues(context.Background(), nil, invalid, nil, info)
		require.Error(t, err, "should error when secure values are not a map")

		err = prepareSecureValues(context.Background(), nil, objWithCreateSecret, invalid, info)
		require.Error(t, err, "should error when previous secure values are not a map")

		err = prepareSecureValues(context.Background(), nil, objWithCreateSecret, nil, info)
		require.Error(t, err, "should error when secure value storage is not configured")

		err = prepareSecureValues(context.Background(), nil, objWithCreateSecret, objWithoutSecrets, info)
		require.Error(t, err, "should error when secure value storage is not configured")

		err = prepareSecureValues(context.Background(), nil, objWithoutSecrets, objWithCreateSecret, info)
		require.Error(t, err, "should error when previous value does not have a name")

		// DELETE Setup errors
		err = handleSecureValuesDelete(context.Background(), nil, invalid)
		require.Error(t, err, "should error when secure values are not a map")

		err = handleSecureValuesDelete(context.Background(), nil, objWithCreateSecret)
		require.Error(t, err, "should error when secure value storage is not configured")
	})
}

func asJSON(v any, pretty bool) string {
	if v == nil {
		return ""
	}
	if pretty {
		bytes, _ := json.MarshalIndent(v, "", "  ")
		return string(bytes)
	}
	bytes, _ := json.Marshal(v)
	return string(bytes)
}
