package dashboard

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	commonV0 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

func newDashboardLargeObjectSupport() *apistore.BasicLargeObjectSupport {
	return &apistore.BasicLargeObjectSupport{
		TheGroupResource: dashboard.DashboardResourceInfo.GroupResource(),

		// byte size, while testing lets do almost everything (10bytes)
		ThresholdSize: 10,

		// 10mb -- we should check what the largest ones are... might be bigger
		MaxByteSize: 10 * 1024 * 1024,

		ReduceSpec: func(obj runtime.Object) error {
			dash, ok := obj.(*dashboard.Dashboard)
			if !ok {
				return fmt.Errorf("expected dashboard")
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
			return nil
		},

		RebuildSpec: func(obj runtime.Object, blob []byte) error {
			dash, ok := obj.(*dashboard.Dashboard)
			if !ok {
				return fmt.Errorf("expected dashboard")
			}
			return json.Unmarshal(blob, &dash.Spec)
		},
	}
}
