package resource

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
)

func TestSecureValues(t *testing.T) {
	raw := &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "playlist.grafana.app/v0alpha1",
			"kind":       "Playlist",
			"metadata": map[string]any{
				"name":      "nn",
				"namespace": "ns",
			},
			"spec": map[string]any{
				"title": "hello",
			},
			"secure": map[string]any{}, // empty
		},
	}
	obj, err := utils.MetaAccessor(raw)
	require.NoError(t, err)
	owner := utils.ToObjectReference(obj)

	t.Run("Invalid input", func(t *testing.T) {
		raw.Object["secure"] = map[string]any{
			"A": common.InlineSecureValue{
				Create: common.NewSecretValue("XXX"),
			},
		}
		secureMock := secret.NewMockInlineSecureValueSupport(t)
		pberr := canReferenceSecureValues(context.Background(), obj, nil, nil)
		require.Equal(t, http.StatusServiceUnavailable, int(pberr.Code), "missing store")

		t.Run("create", func(t *testing.T) {
			raw.Object["secure"] = map[string]any{
				"A": common.InlineSecureValue{
					Create: common.NewSecretValue("XXX"),
				},
			}
			pberr = canReferenceSecureValues(context.Background(), obj, nil, secureMock)
			require.Equal(t, http.StatusUnprocessableEntity, int(pberr.Code))
			require.Equal(t, "secure.A.create", pberr.Details.Causes[0].Field)
		})

		t.Run("remove", func(t *testing.T) {
			raw.Object["secure"] = map[string]any{
				"A": common.InlineSecureValue{
					Remove: true,
				},
			}
			pberr = canReferenceSecureValues(context.Background(), obj, nil, secureMock)
			require.Equal(t, http.StatusUnprocessableEntity, int(pberr.Code))
			require.Equal(t, "secure.A.remove", pberr.Details.Causes[0].Field)
		})

		t.Run("missing name", func(t *testing.T) {
			raw.Object["secure"] = map[string]any{
				"A": common.InlineSecureValue{
					Name: "", // EMPTY
				},
			}
			pberr = canReferenceSecureValues(context.Background(), obj, nil, secureMock)
			require.Equal(t, http.StatusUnprocessableEntity, int(pberr.Code))
			require.Equal(t, "secure.A.name", pberr.Details.Causes[0].Field)
		})

		secureMock.AssertExpectations(t)
	})

	t.Run("OnCreate", func(t *testing.T) {
		raw.Object["secure"] = map[string]any{
			"A": common.InlineSecureValue{
				Name: "111",
			},
			"B": common.InlineSecureValue{
				Name: "111", // duplicate reference, but only checked once
			},
		}
		secureMock := secret.NewMockInlineSecureValueSupport(t)
		secureMock.On("CanReference", mock.Anything, owner, "111").
			Return(nil).Once()

		pberr := canReferenceSecureValues(context.Background(), obj, nil, secureMock)
		require.Nil(t, pberr)
		secureMock.AssertExpectations(t)
	})

	t.Run("OnUpdate", func(t *testing.T) {
		raw.Object["secure"] = map[string]any{
			"A": common.InlineSecureValue{
				Name: "111",
			},
			"B": common.InlineSecureValue{
				Name: "222",
			},
		}

		old, _ := utils.MetaAccessor(&unstructured.Unstructured{})
		secureMock := secret.NewMockInlineSecureValueSupport(t)
		secureMock.On("CanReference", mock.Anything, owner, "111", "222").
			Return(nil).Once()

		pberr := canReferenceSecureValues(context.Background(), obj, old, secureMock)
		require.Nil(t, pberr)
		secureMock.AssertExpectations(t)
	})

	t.Run("OnUpdate with same keys", func(t *testing.T) {
		raw.Object["secure"] = map[string]any{
			"A": common.InlineSecureValue{
				Name: "111",
			},
			"B": common.InlineSecureValue{
				Name: "222",
			},
		}

		old, _ := utils.MetaAccessor(&unstructured.Unstructured{
			Object: map[string]any{
				"secure": map[string]any{
					"A": common.InlineSecureValue{
						Name: "111", // same
					},
					"B": common.InlineSecureValue{
						Name: "Not222",
					},
				}}})
		secureMock := secret.NewMockInlineSecureValueSupport(t)
		secureMock.On("CanReference", mock.Anything, owner, "111", "222").
			Return(nil).Once()

		pberr := canReferenceSecureValues(context.Background(), obj, old, secureMock)
		require.Nil(t, pberr)
		secureMock.AssertExpectations(t)
	})

	t.Run("Update without changes should skip CanReference", func(t *testing.T) {
		raw.Object["secure"] = map[string]any{
			"A": common.InlineSecureValue{
				Name: "111",
			},
		}
		old, _ := utils.MetaAccessor(obj)
		require.NoError(t, err)
		secureMock := secret.NewMockInlineSecureValueSupport(t)

		pberr := canReferenceSecureValues(context.Background(), obj, old, secureMock)
		require.Nil(t, pberr)
		secureMock.AssertExpectations(t) // CanReference should not be called
	})
}
