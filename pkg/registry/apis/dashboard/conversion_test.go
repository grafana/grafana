package dashboard

import (
	"testing"
	"time"

	dashboardinternal "github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/apis/dashboard/migration"
	dashboardv0alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	dashboardv1alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	dashboardv2alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestConvertDashboardVersionsToInternal(t *testing.T) {
	// create the scheme of all the dashboard versions
	// it's all a part of the grand scheme - ‿ -
	scheme := runtime.NewScheme()
	err := dashboardv0alpha1.AddToScheme(scheme)
	require.NoError(t, err)
	err = dashboardv1alpha1.AddToScheme(scheme)
	require.NoError(t, err)
	err = dashboardv2alpha1.AddToScheme(scheme)
	require.NoError(t, err)
	err = dashboardinternal.AddToScheme(scheme)
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
	spec := dashboardinternal.DashboardSpec{}
	err = spec.FromUnstructured(body)
	require.NoError(t, err)
	expectedDashbaord := dashboardinternal.Dashboard{
		ObjectMeta: v1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			CreationTimestamp: v1.NewTime(creationTimestamp),
			Annotations:       annotations,
			Labels:            labels,
			ResourceVersion:   rv,
		},
		Spec: spec,
	}
	dashV0 := &dashboardv0alpha1.Dashboard{
		ObjectMeta: v1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			CreationTimestamp: v1.NewTime(creationTimestamp),
			Annotations:       annotations,
			Labels:            labels,
			ResourceVersion:   rv,
		},
		Spec: migration.Unstructured(body),
	}

	dash, err := ToInternalDashboard(scheme, dashV0)
	require.NoError(t, err)
	require.Equal(t, expectedDashbaord, *dash)
	specWithTitle := spec
	specWithTitle.Title = title

	dashV1 := &dashboardv1alpha1.Dashboard{
		ObjectMeta: v1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			CreationTimestamp: v1.NewTime(creationTimestamp),
			Annotations:       annotations,
			Labels:            labels,
			ResourceVersion:   rv,
		},
		Spec: *specWithTitle.DeepCopy(),
	}
	dash, err = ToInternalDashboard(scheme, dashV1)
	require.NoError(t, err)
	require.Equal(t, expectedDashbaord, *dash)

	dashV2 := &dashboardv2alpha1.Dashboard{
		ObjectMeta: v1.ObjectMeta{
			Name:              name,
			Namespace:         namespace,
			CreationTimestamp: v1.NewTime(creationTimestamp),
			Annotations:       annotations,
			Labels:            labels,
			ResourceVersion:   rv,
		},
		Spec: *specWithTitle.DeepCopy(),
	}
	dash, err = ToInternalDashboard(scheme, dashV2)
	require.NoError(t, err)
	require.Equal(t, expectedDashbaord, *dash)
}
