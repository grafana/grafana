package conversion

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

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
