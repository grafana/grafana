package resource

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type fakeSecureValueSupport struct {
	canReferenceErr error
}

func (f *fakeSecureValueSupport) CanReference(_ context.Context, _ common.ObjectReference, _ ...string) error {
	return f.canReferenceErr
}

func (f *fakeSecureValueSupport) CreateInline(_ context.Context, _ common.ObjectReference, _ common.RawSecureValue, _ *string) (string, error) {
	return "", fmt.Errorf("not expected")
}

func (f *fakeSecureValueSupport) DeleteWhenOwnedByResource(_ context.Context, _ common.ObjectReference, _ ...string) error {
	return fmt.Errorf("not expected")
}

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

	t.Run("Invalid input", func(t *testing.T) {
		raw.Object["secure"] = map[string]any{
			"A": common.InlineSecureValue{
				Create: common.NewSecretValue("XXX"),
			},
		}
		fake := &fakeSecureValueSupport{}
		pberr := canReferenceSecureValues(context.Background(), obj, nil, nil)
		require.Equal(t, http.StatusServiceUnavailable, int(pberr.Code), "missing store")

		t.Run("create", func(t *testing.T) {
			raw.Object["secure"] = map[string]any{
				"A": common.InlineSecureValue{
					Create: common.NewSecretValue("XXX"),
				},
			}
			pberr = canReferenceSecureValues(context.Background(), obj, nil, fake)
			require.Equal(t, http.StatusUnprocessableEntity, int(pberr.Code))
			require.Equal(t, "secure.A.create", pberr.Details.Causes[0].Field)
		})

		t.Run("remove", func(t *testing.T) {
			raw.Object["secure"] = map[string]any{
				"A": common.InlineSecureValue{
					Remove: true,
				},
			}
			pberr = canReferenceSecureValues(context.Background(), obj, nil, fake)
			require.Equal(t, http.StatusUnprocessableEntity, int(pberr.Code))
			require.Equal(t, "secure.A.remove", pberr.Details.Causes[0].Field)
		})

		t.Run("missing name", func(t *testing.T) {
			raw.Object["secure"] = map[string]any{
				"A": common.InlineSecureValue{
					Name: "", // EMPTY
				},
			}
			pberr = canReferenceSecureValues(context.Background(), obj, nil, fake)
			require.Equal(t, http.StatusUnprocessableEntity, int(pberr.Code))
			require.Equal(t, "secure.A.name", pberr.Details.Causes[0].Field)
		})
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

		pberr := canReferenceSecureValues(context.Background(), obj, nil, &fakeSecureValueSupport{})
		require.Nil(t, pberr)
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

		pberr := canReferenceSecureValues(context.Background(), obj, old, &fakeSecureValueSupport{})
		require.Nil(t, pberr)
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

		pberr := canReferenceSecureValues(context.Background(), obj, old, &fakeSecureValueSupport{})
		require.Nil(t, pberr)
	})

	t.Run("Update without changes should skip CanReference", func(t *testing.T) {
		raw.Object["secure"] = map[string]any{
			"A": common.InlineSecureValue{
				Name: "111",
			},
		}

		// CanReference should not be called; if it were, the error would surface.
		pberr := canReferenceSecureValues(context.Background(), obj, obj, &fakeSecureValueSupport{
			canReferenceErr: fmt.Errorf("should not be called"),
		})
		require.Nil(t, pberr)
	})

	t.Run("upstream errors", func(t *testing.T) {
		raw.Object["secure"] = map[string]any{
			"A": common.InlineSecureValue{
				Name: "111",
			},
		}

		pberr := canReferenceSecureValues(context.Background(), obj, nil, &fakeSecureValueSupport{
			canReferenceErr: fmt.Errorf("nope"),
		})
		require.NotNil(t, pberr)

		// Check CanReference when the old value is invalid
		old, _ := utils.MetaAccessor(&unstructured.Unstructured{
			Object: map[string]any{"secure": t}})

		pberr = canReferenceSecureValues(context.Background(), obj, old, &fakeSecureValueSupport{})
		require.Nil(t, pberr)
	})
}
