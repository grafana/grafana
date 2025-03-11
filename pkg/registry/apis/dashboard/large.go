package dashboard

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	commonV0 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboardV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	dashboardV2 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

func NewDashboardLargeObjectSupport(scheme *runtime.Scheme) *apistore.BasicLargeObjectSupport {
	return &apistore.BasicLargeObjectSupport{
		TheGroupResource: dashboardV0.DashboardResourceInfo.GroupResource(),

		// byte size, while testing lets do almost everything (10bytes)
		ThresholdSize: 10,

		// 10mb -- we should check what the largest ones are... might be bigger
		MaxByteSize: 10 * 1024 * 1024,

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
			case *dashboardV2.Dashboard:
				reduceUnstructredSpec(&dash.Spec)
			default:
				return fmt.Errorf("unsupported dashboard type %T", obj)
			}

			meta.SetManagedFields(nil) // this could be bigger than the object!
			return nil
		},

		RebuildSpec: func(obj runtime.Object, blob []byte) error {
			body := commonV0.Unstructured{}
			err := body.UnmarshalJSON(blob)
			if err != nil {
				return err
			}

			switch dash := obj.(type) {
			case *dashboardV0.Dashboard:
				dash.Spec = body
			case *dashboardV1.Dashboard:
				dash.Spec = body
			case *dashboardV2.Dashboard:
				dash.Spec = body
			default:
				return fmt.Errorf("unsupported dashboard type %T", obj)
			}
			return nil
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
