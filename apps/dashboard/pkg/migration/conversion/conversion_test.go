package conversion

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestConversionMatrixExist(t *testing.T) {
	versions := []v1.Object{
		&dashv0.Dashboard{Spec: common.Unstructured{Object: map[string]any{"title": "dashboardV0"}}},
		&dashv1.Dashboard{Spec: common.Unstructured{Object: map[string]any{"title": "dashboardV1"}}},
		&dashv2.Dashboard{Spec: dashv2.DashboardSpec{Title: "dashboardV2"}},
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

func TestDeepCopyValid(t *testing.T) {
	dash1 := &dashv0.Dashboard{}
	meta1, err := utils.MetaAccessor(dash1)
	require.NoError(t, err)
	meta1.SetFolder("f1")
	require.Equal(t, "f1", dash1.Annotations[utils.AnnoKeyFolder])

	dash1Copy := dash1.DeepCopyObject()
	metaCopy, err := utils.MetaAccessor(dash1Copy)
	require.NoError(t, err)
	require.Equal(t, "f1", metaCopy.GetFolder())

	// Changing a property on the copy should not effect the original
	metaCopy.SetFolder("XYZ")
	require.Equal(t, "f1", meta1.GetFolder()) // 💣💣💣
}
