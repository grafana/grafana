package generic_test

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/apis/example"
)

func TestPrepareForUpdate(t *testing.T) {
	ctx := context.TODO()
	gv := schema.GroupVersion{Group: "test", Version: "v1"}
	strategy := generic.NewStrategy(runtime.NewScheme(), gv)

	oldObj := &example.Pod{
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

	testCases := []struct {
		name        string
		newObj      *example.Pod
		oldObj      *example.Pod
		expectedGen int64
		expectedObj *example.Pod
	}{
		{
			name: "ignore status updates",
			newObj: &example.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Namespace:  "default",
					Generation: 1,
				},
				Spec: example.PodSpec{
					NodeSelector: map[string]string{"foo": "bar"},
				},
				Status: example.PodStatus{
					Phase: example.PodPhase("Stopped"),
				},
			},
			oldObj:      oldObj.DeepCopy(),
			expectedGen: 2,
			expectedObj: &example.Pod{
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
			},
		},
		{
			name: "increment generation if spec changes",
			newObj: &example.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Namespace:  "default",
					Generation: 1,
				},
				Spec: example.PodSpec{
					NodeSelector: map[string]string{"foo": "baz"},
				},
				Status: example.PodStatus{
					Phase: example.PodPhase("Running"),
				},
			},
			oldObj:      oldObj.DeepCopy(),
			expectedGen: 2,
			expectedObj: &example.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test",
					Namespace:  "default",
					Generation: 2,
				},
				Spec: example.PodSpec{
					NodeSelector: map[string]string{"foo": "baz"},
				},
				Status: example.PodStatus{
					Phase: example.PodPhase("Running"),
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			strategy.PrepareForUpdate(ctx, tc.newObj, tc.oldObj)
			require.Equal(t, tc.expectedObj, tc.newObj)
		})
	}
}

func TestPrepareForCreate(t *testing.T) {
	ctx := context.TODO()
	gv := schema.GroupVersion{Group: "test", Version: "v1"}
	strategy := generic.NewStrategy(runtime.NewScheme(), gv)

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

	strategy.PrepareForCreate(ctx, obj)
	require.Equal(t, int64(1), obj.Generation)
	require.Equal(t, example.PodStatus{}, obj.Status)
}
