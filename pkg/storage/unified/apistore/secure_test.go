package apistore

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret"
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
		defer secureStore.AssertExpectations(t)
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
		require.Equal(t, []string{"NameForA", "NameForB"}, info.createdSecureValues)
		secure, err := obj.GetSecureValues()
		require.NoError(t, err)
		require.JSONEq(t, `{
			"a": {"name": "NameForA"},
			"b": {"name": "NameForB"}
		}`, asJSON(secure, true))
	})

	t.Run("change name manually", func(t *testing.T) {
		secureStore := secret.NewMockInlineSecureValueSupport(t)

		info := &objectForStorage{}
		previous := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "111"},
		})
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Create: "222"},
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

	t.Run("delete resource", func(t *testing.T) {
		secureStore := secret.NewMockInlineSecureValueSupport(t)
		obj := resourceWithSecureValues(common.InlineSecureValues{
			"a": common.InlineSecureValue{Name: "NameForA"},
		})
		owner := utils.ToObjectReference(obj)
		secureStore.On("DeleteWhenOwnedByResource", mock.Anything, owner, "NameForA").
			Return(nil).Once()

		err := handleSecureValuesDelete(context.Background(), secureStore, obj)
		require.NoError(t, err)
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
