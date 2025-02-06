package dashboard

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	commonV0 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

func NewDashboardLargeObjectSupport(scheme *runtime.Scheme) *apistore.BasicLargeObjectSupport {
	return &apistore.BasicLargeObjectSupport{
		TheGroupResource: dashboard.DashboardResourceInfo.GroupResource(),

		// byte size, while testing lets do almost everything (10bytes)
		ThresholdSize: 10,

		// 10mb -- we should check what the largest ones are... might be bigger
		MaxByteSize: 10 * 1024 * 1024,

		ReduceSpec: func(obj runtime.Object) error {
			dash, err := ToInternalDashboard(scheme, obj)
			if err != nil {
				return err
			}
			old := dash.Spec.Object
			spec := commonV0.Unstructured{Object: make(map[string]any)}
			dash.Spec = spec
			dash.SetManagedFields(nil) // this could be bigger than the object!

			keep := []string{"title", "description", "schemaVersion"}
			for _, k := range keep {
				v, ok := old[k]
				if ok {
					spec.Object[k] = v
				}
			}

			if err := scheme.Convert(dash, obj, nil); err != nil {
				return fmt.Errorf("failed to update original object: %w", err)
			}

			return nil
		},

		RebuildSpec: func(obj runtime.Object, blob []byte) error {
			dash, err := ToInternalDashboard(scheme, obj)
			if err != nil {
				return err
			}
			// TODO figure out how we want to set the spec. Do we
			// want to use the byte array? Do we want to pass in the the
			// metaAccessor instead of (or in addition to) the runtime.Object?
			err = json.Unmarshal(blob, &dash.Spec)

			meta, err := utils.MetaAccessor(obj)
			if err != nil {
				return err
			}

			return meta.SetSpec(dash.Spec)
		},
	}
}
