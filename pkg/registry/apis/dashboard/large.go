package dashboard

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2alpha2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha2"
	commonV0 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

func NewDashboardLargeObjectSupport(scheme *runtime.Scheme, threshold int) *apistore.BasicLargeObjectSupport {
	return &apistore.BasicLargeObjectSupport{
		TheGroupResource: dashboardV0.DashboardResourceInfo.GroupResource(),

		// Byte size above which an object is considered large.
		ThresholdBytes: threshold,

		// 10mb -- we should check what the largest ones are... might be bigger
		MaxBytes: 10 * 1024 * 1024,

		ReduceSpec: func(obj runtime.Object) error {
			meta, err := utils.MetaAccessor(obj)
			if err != nil {
				return err
			}

			switch dash := obj.(type) {
			case *dashboardV0.Dashboard:
				reduceUnstructredSpec(&dash.Spec)
			case *dashboardV1.Dashboard:
				reduceUnstructredSpec(&dash.Spec)
			case *dashboardV2alpha1.Dashboard:
				dash.Spec = dashboardV2alpha1.DashboardSpec{
					Title:       dash.Spec.Title,
					Description: dash.Spec.Description,
					Tags:        dash.Spec.Tags,
				}
			case *dashboardV2alpha2.Dashboard:
				dash.Spec = dashboardV2alpha2.DashboardSpec{
					Title:       dash.Spec.Title,
					Description: dash.Spec.Description,
					Tags:        dash.Spec.Tags,
				}
			default:
				return fmt.Errorf("unsupported dashboard type %T", obj)
			}

			meta.SetManagedFields(nil) // this could be bigger than the object!
			return nil
		},

		RebuildSpec: func(obj runtime.Object, blob []byte) error {
			switch dash := obj.(type) {
			case *dashboardV0.Dashboard:
				return dash.Spec.UnmarshalJSON(blob)
			case *dashboardV1.Dashboard:
				return dash.Spec.UnmarshalJSON(blob)
			case *dashboardV2alpha1.Dashboard:
				return json.Unmarshal(blob, &dash.Spec)
			case *dashboardV2alpha2.Dashboard:
				return json.Unmarshal(blob, &dash.Spec)
			default:
				return fmt.Errorf("unsupported dashboard type %T", obj)
			}
		},
	}
}

func reduceUnstructredSpec(spec *commonV0.Unstructured) {
	vals := make(map[string]any, 5)
	keep := []string{"title", "description", "tags", "schemaVersion"}
	for _, k := range keep {
		v, ok := spec.Object[k]
		if ok {
			vals[k] = v
		}
	}
	spec.Object = vals
}
