package conversion

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestConversionMatrixExist(t *testing.T) {
	versions := []v1.Object{
		&v0alpha1.Dashboard{Spec: common.Unstructured{Object: map[string]any{"title": "dashboardV0"}}},
		&v1alpha1.Dashboard{Spec: common.Unstructured{Object: map[string]any{"title": "dashboardV1"}}},
		&v2alpha1.Dashboard{Spec: v2alpha1.DashboardSpec{Title: "dashboardV2"}},
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

			// Make sure we get the right title for each value
			meta, err := utils.MetaAccessor(in)
			require.NoError(t, err)
			require.True(t, strings.HasPrefix(meta.FindTitle(""), "dashboard"))
		})
	}
}
