package dashboard

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

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
			old, err := dash.Spec.ToUnstructured()
			if err != nil {
				return fmt.Errorf("failed to convert to unstructured: %w", err)
			}
			u := map[string]interface{}{}
			dash.SetManagedFields(nil) // this could be bigger than the object!

			keep := []string{"title", "description", "schemaVersion"}
			for _, k := range keep {
				v, ok := old[k]
				if ok {
					u[k] = v
				}
			}

			err = dash.Spec.FromUnstructured(u)
			if err != nil {
				return fmt.Errorf("failed to convert from unstructured: %w", err)
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
			return json.Unmarshal(blob, &dash.Spec)
		},
	}
}
