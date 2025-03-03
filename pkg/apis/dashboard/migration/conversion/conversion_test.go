package conversion

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	dashboardV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	dashboardV2 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
)

func TestConversionMatrixExist(t *testing.T) {
	versions := []v1.Object{
		&dashboardV0.Dashboard{},
		&dashboardV1.Dashboard{},
		&dashboardV2.Dashboard{},
	}

	scheme := runtime.NewScheme()
	err := RegisterConversions(scheme)
	require.NoError(t, err)

	for idx, in := range versions {
		kind := fmt.Sprintf("%T", in)[1:]
		t.Run(kind, func(t *testing.T) {
			for i, out := range versions {
				if i == idx {
					continue // skip the same version
				}
				err = scheme.Convert(in, out, nil)
				require.NoError(t, err)
			}
		})
	}
}

func TestConvertDashboardVersionsToInternal(t *testing.T) {
	// create the scheme of all the dashboard versions
	// it's all a part of the grand scheme - ‿ -
	scheme := runtime.NewScheme()
	err := dashboardV0.AddToScheme(scheme)
	require.NoError(t, err)
	err = dashboardV1.AddToScheme(scheme)
	require.NoError(t, err)
	err = dashboardV2.AddToScheme(scheme)
	require.NoError(t, err)

	// all dashboard versions in this test have the same info inside
	// so, the internal version should be the same when going back and forth
	creationTimestamp := time.Now()
	name := "test"
	title := "New dashboard"
	namespace := "default"
	annotations := map[string]string{"created-by": "me"}
	labels := map[string]string{"starred-by": "you"}
	rv := "1"
	body := map[string]interface{}{"title": title, "description": "A new dashboard"}
	expectedDashbaord := dashboardV0.Dashboard{
		ObjectMeta: v1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			CreationTimestamp: v1.NewTime(creationTimestamp),
			Annotations:       annotations,
			Labels:            labels,
			ResourceVersion:   rv,
		},
		Spec: common.Unstructured{Object: body},
	}
	dashV0 := &dashboardV0.Dashboard{
		ObjectMeta: v1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			CreationTimestamp: v1.NewTime(creationTimestamp),
			Annotations:       annotations,
			Labels:            labels,
			ResourceVersion:   rv,
		},
		Spec: common.Unstructured{
			Object: body,
		},
	}

	dash, err := ToInternalDashboardV0(scheme, dashV0)
	require.NoError(t, err)
	require.Equal(t, expectedDashbaord, *dash)

	dashV1 := &dashboardV1.Dashboard{
		ObjectMeta: v1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			CreationTimestamp: v1.NewTime(creationTimestamp),
			Annotations:       annotations,
			Labels:            labels,
			ResourceVersion:   rv,
		},
		Spec: common.Unstructured{Object: body},
	}
	dash, err = ToInternalDashboardV0(scheme, dashV1)
	require.NoError(t, err)
	require.Equal(t, expectedDashbaord, *dash)

	dashV2 := &dashboardV2.Dashboard{
		ObjectMeta: v1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			CreationTimestamp: v1.NewTime(creationTimestamp),
			Annotations:       annotations,
			Labels:            labels,
			ResourceVersion:   rv,
		},
		Spec: common.Unstructured{Object: body},
	}
	dash, err = ToInternalDashboardV0(scheme, dashV2)
	require.NoError(t, err)
	require.Equal(t, expectedDashbaord, *dash)
}
