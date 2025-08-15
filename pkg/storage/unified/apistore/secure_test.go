package apistore

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
)

func TestSecureLifecycle(t *testing.T) {
	resourceWithSecureValues := func(sv common.InlineSecureValues) utils.GrafanaMetaAccessor {
		obj, err := utils.MetaAccessor(&unstructured.Unstructured{
			Object: map[string]any{
				"apiVersion": "something.grafana.app/v1beta1",
				"kind":       "CustomKind",
				"metadata": map[string]any{
					"namespace": "default",
					"name":      "test",
				},
				"secure": sv,
			},
		})
		require.NoError(t, err)
		return obj
	}

	t.Run("create secure values", func(t *testing.T) {
		secureStore := secret.NewMockInlineSecureValueSupport(t)
		secureStore.On("CreateInline", mock.Anything, mock.Anything, common.RawSecureValue("SecretAAA")).
			Return("NameForA", nil).Once()
		secureStore.On("CreateInline", mock.Anything, mock.Anything, common.RawSecureValue("SecretBBB")).
			Return("NameForB", nil).Once()

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
		secureStore.AssertExpectations(t)
	})

	t.Run("create secure values with errors", func(t *testing.T) {
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Create: "SecretAAA"},
			"b": common.InlineSecureValue{Create: "SecretBBB"},
		})

		info := &objectForStorage{}
		expectError := fmt.Errorf("expected error")
		secureStore := secret.NewMockInlineSecureValueSupport(t)
		secureStore.On("CreateInline", mock.Anything, mock.Anything, common.RawSecureValue("SecretAAA")).
			Return("", expectError).Once()
		err := prepareSecureValues(context.Background(), secureStore, obj, nil, info)
		require.Error(t, err, "should error when secure value creation fails")
		require.Equal(t, expectError, err, "error should be propagated")
		secureStore.AssertExpectations(t)
	})

	t.Run("change name manually", func(t *testing.T) {
		secureStore := secret.NewMockInlineSecureValueSupport(t)

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
		secureStore := secret.NewMockInlineSecureValueSupport(t)

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
		secureStore := secret.NewMockInlineSecureValueSupport(t)
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
		require.True(t, info.hasChanged)  // value was removed
		secureStore.AssertExpectations(t) // nothing called

		secure, err := obj.GetSecureValues()
		require.NoError(t, err)
		require.JSONEq(t, `{
			"a": {"name": "NameForA"},
			"c": {"name": "NameForC"}
		}`, asJSON(secure, true))

		// When there is not an error, the finish command will do a real delete
		owner := utils.ToObjectReference(obj)
		secureStore.On("DeleteWhenOwnedByResource", mock.Anything, owner, "NameForB").
			Return(nil).Once()
		err = info.finish(context.Background(), nil, secureStore)
		require.NoError(t, err)
		require.True(t, info.hasChanged)  // value was removed
		secureStore.AssertExpectations(t) // nothing called

		// When an error exists, no values will be deleted
		err = fmt.Errorf("expected error")
		outErr := info.finish(context.Background(), err, secureStore)
		require.Equal(t, err, outErr, "error should be passed through")
	})

	t.Run("remove invalid secure values", func(t *testing.T) {
		secureStore := secret.NewMockInlineSecureValueSupport(t)
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"b": common.InlineSecureValue{Remove: true},
		})

		// Previous values must exist for remove to execute
		info := &objectForStorage{}
		err := prepareSecureValues(context.Background(), secureStore, obj, resourceWithSecureValues(nil), info)
		require.Error(t, err, "should error when previous secure values does not exist")
		require.Equal(t, "cannot remove secure value 'b', it did not exist in the previous value", err.Error())
		secureStore.AssertExpectations(t)
	})

	t.Run("delete resource", func(t *testing.T) {
		secureStore := secret.NewMockInlineSecureValueSupport(t)
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "NameForA"},
		})
		sv, err := obj.GetSecureValues()
		require.NoError(t, err)
		require.Len(t, sv, 1)

		owner := utils.ToObjectReference(obj)
		secureStore.On("DeleteWhenOwnedByResource", mock.Anything, owner, "NameForA").
			Return(nil).Once()

		err = handleSecureValuesDelete(context.Background(), secureStore, obj)
		require.NoError(t, err)
		secureStore.AssertExpectations(t)
		sv, err = obj.GetSecureValues()
		require.NoError(t, err)
		require.Empty(t, sv, "secure values should be empty after delete")

		// Delete should propagate deletion errors
		obj = resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "NameForA"},
		})
		expectError := fmt.Errorf("expected error")
		secureStore = secret.NewMockInlineSecureValueSupport(t)
		secureStore.On("DeleteWhenOwnedByResource", mock.Anything, owner, "NameForA").
			Return(expectError).Once()
		err = handleSecureValuesDelete(context.Background(), secureStore, obj)
		require.Equal(t, expectError, err, "error should be passed through")
		secureStore.AssertExpectations(t)
	})

	t.Run("invalid states", func(t *testing.T) {
		secureStore := secret.NewMockInlineSecureValueSupport(t)

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
