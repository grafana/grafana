package generic_test

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/apis/example"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
)

func TestGenericStrategy(t *testing.T) {
	t.Parallel()
	gv := schema.GroupVersion{Group: "test", Version: "v1"}

	t.Run("PrepareForUpdate", func(t *testing.T) {
		t.Parallel()

		obj := &example.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test",
				Namespace:  "default",
				Generation: 1,
			},
			Spec: example.PodSpec{
				NodeSelector: map[string]string{"foo": "bar"},
			},
			Status: example.PodStatus{
				Phase: example.PodPhase("Running"),
			},
		}

		t.Run("ignores status updates", func(t *testing.T) {
			t.Parallel()
			oldObj := obj.DeepCopy()
			newObj := obj.DeepCopy()
			newObj.Status.Phase = example.PodPhase("Stopped")
			expectedObj := obj.DeepCopy()

			strategy := generic.NewStrategy(runtime.NewScheme(), gv)
			strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
			require.Equal(t, expectedObj, newObj)
		})

		t.Run("does not increment generation if annotations, labels, finalizers, or owner references change", func(t *testing.T) {
			t.Parallel()
			oldObj := obj.DeepCopy()
			newObj := obj.DeepCopy()
			newObj.Annotations = map[string]string{"foo": "baz"}
			newObj.Labels = map[string]string{"foo": "baz"}
			newObj.Finalizers = []string{"foo"}
			newObj.OwnerReferences = []metav1.OwnerReference{{Name: "foo"}}

			strategy := generic.NewStrategy(runtime.NewScheme(), gv)
			strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
			assert.Equal(t, map[string]string{"foo": "baz"}, newObj.Annotations)
			assert.Equal(t, map[string]string{"foo": "baz"}, newObj.Labels)
			assert.Equal(t, []string{"foo"}, newObj.Finalizers)
			assert.Equal(t, []metav1.OwnerReference{{Name: "foo"}}, newObj.OwnerReferences)
			assert.Equal(t, int64(1), newObj.Generation)
		})

		t.Run("does not increment generation if spec changes", func(t *testing.T) {
			t.Parallel()
			oldObj := obj.DeepCopy()
			newObj := obj.DeepCopy()
			newObj.Spec.NodeSelector = map[string]string{"foo": "baz"}
			expectedObj := newObj.DeepCopy()

			strategy := generic.NewStrategy(runtime.NewScheme(), gv)
			strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
			require.Equal(t, expectedObj, newObj)
		})
	})

	t.Run("PrepareForCreate", func(t *testing.T) {
		t.Parallel()

		obj := &example.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test",
				Namespace: "default",
			},
			Spec: example.PodSpec{
				NodeSelector: map[string]string{"foo": "bar"},
			},
			Status: example.PodStatus{
				Phase: example.PodPhase("Running"),
			},
		}

		t.Run("assigns generation=1", func(t *testing.T) {
			t.Parallel()
			strategy := generic.NewStrategy(runtime.NewScheme(), gv)
			obj := obj.DeepCopy()

			strategy.PrepareForCreate(t.Context(), obj)
			require.Equal(t, int64(1), obj.Generation)
		})

		t.Run("clears status", func(t *testing.T) {
			t.Parallel()
			strategy := generic.NewStrategy(runtime.NewScheme(), gv)
			obj := obj.DeepCopy()

			strategy.PrepareForCreate(t.Context(), obj)
			require.Equal(t, example.PodStatus{}, obj.Status)
		})

		t.Run("leaves spec untouched", func(t *testing.T) {
			t.Parallel()
			strategy := generic.NewStrategy(runtime.NewScheme(), gv)
			obj := obj.DeepCopy()
			originalSpec := *obj.Spec.DeepCopy()

			strategy.PrepareForCreate(t.Context(), obj)
			require.Equal(t, originalSpec, obj.Spec)
		})
	})
}

func TestStatusStrategy(t *testing.T) {
	t.Parallel()
	gv := schema.GroupVersion{Group: "test", Version: "v1"}

	t.Run("PrepareForUpdate", func(t *testing.T) {
		t.Parallel()

		obj := &example.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test",
				Namespace:  "default",
				Generation: 1,
			},
			Spec: example.PodSpec{
				NodeSelector: map[string]string{"foo": "bar"},
			},
			Status: example.PodStatus{
				Phase: example.PodPhase("Running"),
			},
		}

		t.Run("ignores spec updates", func(t *testing.T) {
			// The assumption here is that the status strategy should not allow for spec updates.
			// This is drawn due to the GetResetFields function returning `metadata` and `spec`, and due to it copying old `metadata` fields to the new object (but not spec?).
			t.Skip("assumption does not hold -- verify with app platform if this is intended")

			t.Parallel()
			oldObj := obj.DeepCopy()
			newObj := obj.DeepCopy()
			newObj.Spec.NodeSelector = map[string]string{"foo": "baz"}
			expectedObj := obj.DeepCopy()

			strategy := generic.NewStatusStrategy(runtime.NewScheme(), gv)
			strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
			require.Equal(t, expectedObj, newObj)
		})

		t.Run("ignores label updates", func(t *testing.T) {
			t.Parallel()
			oldObj := obj.DeepCopy()
			newObj := obj.DeepCopy()
			newObj.Labels = map[string]string{"foo": "baz"}
			expectedObj := obj.DeepCopy()

			strategy := generic.NewStatusStrategy(runtime.NewScheme(), gv)
			strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
			require.Equal(t, expectedObj, newObj)
		})

		t.Run("ignores annotation updates", func(t *testing.T) {
			t.Parallel()
			oldObj := obj.DeepCopy()
			newObj := obj.DeepCopy()
			newObj.Annotations = map[string]string{"foo": "baz"}
			expectedObj := obj.DeepCopy()

			strategy := generic.NewStatusStrategy(runtime.NewScheme(), gv)
			strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
			require.Equal(t, expectedObj, newObj)
		})

		t.Run("ignores finalizer updates", func(t *testing.T) {
			t.Parallel()
			oldObj := obj.DeepCopy()
			newObj := obj.DeepCopy()
			newObj.Finalizers = []string{"foo"}
			expectedObj := obj.DeepCopy()

			strategy := generic.NewStatusStrategy(runtime.NewScheme(), gv)
			strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
			require.Equal(t, expectedObj, newObj)
		})

		t.Run("ignores owner references updates", func(t *testing.T) {
			t.Parallel()
			oldObj := obj.DeepCopy()
			newObj := obj.DeepCopy()
			newObj.OwnerReferences = []metav1.OwnerReference{{Name: "foo"}}
			expectedObj := obj.DeepCopy()

			strategy := generic.NewStatusStrategy(runtime.NewScheme(), gv)
			strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
			require.Equal(t, expectedObj, newObj)
		})

		t.Run("does not increment generation on status changes", func(t *testing.T) {
			t.Parallel()
			oldObj := obj.DeepCopy()
			newObj := obj.DeepCopy()
			newObj.Status.Phase = example.PodPhase("Stopped")

			strategy := generic.NewStatusStrategy(runtime.NewScheme(), gv)
			strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
			require.Equal(t, int64(1), newObj.Generation)
		})
	})
}

func TestCompleteStrategy(t *testing.T) {
	t.Parallel()
	gv := schema.GroupVersion{Group: "test", Version: "v1"}

	t.Run("PrepareForUpdate", func(t *testing.T) {
		t.Parallel()

		obj := &example.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:       "test",
				Namespace:  "default",
				Generation: 1,
			},
			Spec: example.PodSpec{
				NodeSelector: map[string]string{"foo": "bar"},
			},
			Status: example.PodStatus{
				Phase: example.PodPhase("Running"),
			},
		}

		t.Run("on status updates", func(t *testing.T) {
			t.Parallel()

			t.Run("keeps the change", func(t *testing.T) {
				t.Parallel()
				oldObj := obj.DeepCopy()
				newObj := obj.DeepCopy()
				newObj.Status.Phase = example.PodPhase("Stopped")

				strategy := generic.NewCompleteStrategy(runtime.NewScheme(), gv)
				strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
				require.Equal(t, example.PodPhase("Stopped"), newObj.Status.Phase)
			})

			t.Run("does not change generation", func(t *testing.T) {
				t.Parallel()
				oldObj := obj.DeepCopy()
				newObj := obj.DeepCopy()
				newObj.Status.Phase = example.PodPhase("Stopped")

				strategy := generic.NewCompleteStrategy(runtime.NewScheme(), gv)
				strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
				require.Equal(t, int64(1), newObj.Generation)
			})
		})

		t.Run("on spec updates", func(t *testing.T) {
			t.Parallel()

			t.Run("keeps the change", func(t *testing.T) {
				t.Parallel()
				oldObj := obj.DeepCopy()
				newObj := obj.DeepCopy()
				newObj.Spec.NodeSelector = map[string]string{"foo": "baz"}

				strategy := generic.NewCompleteStrategy(runtime.NewScheme(), gv)
				strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
				require.Equal(t, map[string]string{"foo": "baz"}, newObj.Spec.NodeSelector)
			})

			t.Run("does not increment generation", func(t *testing.T) {
				t.Parallel()
				oldObj := obj.DeepCopy()
				newObj := obj.DeepCopy()
				newObj.Spec.NodeSelector = map[string]string{"foo": "baz"}

				strategy := generic.NewCompleteStrategy(runtime.NewScheme(), gv)
				strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
				require.Equal(t, int64(1), newObj.Generation)
			})
		})

		t.Run("on metadata updates", func(t *testing.T) {
			t.Parallel()

			t.Run("keeps the change", func(t *testing.T) {
				t.Parallel()
				oldObj := obj.DeepCopy()
				newObj := obj.DeepCopy()
				newObj.Annotations = map[string]string{"foo": "baz"}
				newObj.Labels = map[string]string{"foo": "baz"}
				newObj.Finalizers = []string{"foo"}
				newObj.OwnerReferences = []metav1.OwnerReference{{Name: "foo"}}

				strategy := generic.NewCompleteStrategy(runtime.NewScheme(), gv)
				strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
				assert.Equal(t, map[string]string{"foo": "baz"}, newObj.Annotations)
				assert.Equal(t, map[string]string{"foo": "baz"}, newObj.Labels)
				assert.Equal(t, []string{"foo"}, newObj.Finalizers)
				assert.Equal(t, []metav1.OwnerReference{{Name: "foo"}}, newObj.OwnerReferences)
			})

			t.Run("does not increment generation", func(t *testing.T) {
				t.Parallel()
				oldObj := obj.DeepCopy()
				newObj := obj.DeepCopy()
				newObj.Annotations = map[string]string{"foo": "baz"}
				newObj.Labels = map[string]string{"foo": "baz"}
				newObj.Finalizers = []string{"foo"}
				newObj.OwnerReferences = []metav1.OwnerReference{{Name: "foo"}}

				strategy := generic.NewCompleteStrategy(runtime.NewScheme(), gv)
				strategy.PrepareForUpdate(t.Context(), newObj, oldObj)
				assert.Equal(t, int64(1), newObj.Generation)
			})
		})
	})

	t.Run("PrepareForCreate", func(t *testing.T) {
		t.Parallel()

		obj := &example.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test",
				Namespace: "default",
			},
			Spec: example.PodSpec{
				NodeSelector: map[string]string{"foo": "bar"},
			},
			Status: example.PodStatus{
				Phase: example.PodPhase("Running"),
			},
		}

		t.Run("assigns generation=1", func(t *testing.T) {
			t.Parallel()

			t.Run("when generation is not set", func(t *testing.T) {
				t.Parallel()
				strategy := generic.NewCompleteStrategy(runtime.NewScheme(), gv)
				obj := obj.DeepCopy()

				strategy.PrepareForCreate(t.Context(), obj)
				require.Equal(t, int64(1), obj.Generation)
			})

			t.Run("when generation is set to a higher value", func(t *testing.T) {
				t.Parallel()
				strategy := generic.NewCompleteStrategy(runtime.NewScheme(), gv)
				obj := obj.DeepCopy()
				obj.Generation = 2

				strategy.PrepareForCreate(t.Context(), obj)
				require.Equal(t, int64(1), obj.Generation)
			})
		})
	})
}

func TestPrepareForCreateClearsClientResourceVersion(t *testing.T) {
	t.Parallel()
	gv := schema.GroupVersion{Group: "test", Version: "v1"}

	withVerb := func(verb string) context.Context {
		return genericapirequest.WithRequestInfo(t.Context(), &genericapirequest.RequestInfo{Verb: verb})
	}

	tests := []struct {
		name        string
		ctx         context.Context
		wantCleared bool
	}{
		{name: "create request", ctx: withVerb("create"), wantCleared: true},
		// In-process create-on-update has no request info; it must keep the version for
		// optimistic concurrency (e.g. the GlobalRole reconciler).
		{name: "in-process create-on-update (no request info)", ctx: t.Context(), wantCleared: false},
		{name: "create-on-update (PUT)", ctx: withVerb("update"), wantCleared: false},
		{name: "create-on-apply (PATCH)", ctx: withVerb("patch"), wantCleared: false},
	}

	strategies := []struct {
		name     string
		strategy interface {
			PrepareForCreate(context.Context, runtime.Object)
		}
	}{
		{name: "genericStrategy", strategy: generic.NewStrategy(runtime.NewScheme(), gv)},
		{name: "genericCompleteStrategy", strategy: generic.NewCompleteStrategy(runtime.NewScheme(), gv)},
	}

	for _, s := range strategies {
		for _, tt := range tests {
			t.Run(s.name+"/"+tt.name, func(t *testing.T) {
				t.Parallel()
				obj := &example.Pod{ObjectMeta: metav1.ObjectMeta{
					Name:            "test",
					Namespace:       "default",
					ResourceVersion: "123",
				}}

				s.strategy.PrepareForCreate(tt.ctx, obj)
				if tt.wantCleared {
					require.Empty(t, obj.ResourceVersion)
				} else {
					require.Equal(t, "123", obj.ResourceVersion)
				}
			})
		}
	}
}

func TestGetAttrs(t *testing.T) {
	t.Parallel()

	t.Run("returns all labels", func(t *testing.T) {
		t.Parallel()

		t.Run("when labels is nil", func(t *testing.T) {
			t.Parallel()

			obj := &example.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test",
					Namespace: "default",
					Labels:    nil,
				},
			}

			labels, _, err := generic.GetAttrs(obj)
			require.NoError(t, err)

			require.Empty(t, labels, "expected no labels")
		})

		t.Run("when there are no labels", func(t *testing.T) {
			t.Parallel()

			obj := &example.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test",
					Namespace: "default",
					Labels:    make(map[string]string),
				},
			}

			labels, _, err := generic.GetAttrs(obj)
			require.NoError(t, err)

			require.Empty(t, labels, "expected no labels")
		})

		t.Run("when there is only 1 label", func(t *testing.T) {
			t.Parallel()

			obj := &example.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test",
					Namespace: "default",
					Labels:    map[string]string{"foo": "bar"},
				},
			}

			l, _, err := generic.GetAttrs(obj)
			require.NoError(t, err)

			require.Equal(t, labels.Set{"foo": "bar"}, l, "expected labels to match")
		})

		t.Run("when there are many labels", func(t *testing.T) {
			t.Parallel()

			obj := &example.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test",
					Namespace: "default",
					Labels:    map[string]string{"foo": "bar", "baz": "qux", "grafana": "is-cool"},
				},
			}

			l, _, err := generic.GetAttrs(obj)
			require.NoError(t, err)

			require.Equal(t, labels.Set{"foo": "bar", "baz": "qux", "grafana": "is-cool"}, l, "expected labels to match")
		})
	})

	t.Run("includes only name in fields", func(t *testing.T) {
		t.Parallel()

		obj := &example.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test",
				Namespace: "default",
			},
		}

		_, f, err := generic.GetAttrs(obj)
		require.NoError(t, err)

		require.Equal(t, fields.Set{"metadata.name": "test"}, f, "expected fields to match")
	})
}
