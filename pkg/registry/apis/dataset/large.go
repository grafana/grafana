package dataset

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	dataset "github.com/grafana/grafana/pkg/apis/dataset/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

func NewDatasetLargeObjectSupport(scheme *runtime.Scheme) *apistore.BasicLargeObjectSupport {
	return &apistore.BasicLargeObjectSupport{
		TheGroupResource: dataset.DatasetResourceInfo.GroupResource(),

		// byte size, while testing lets do almost everything (10bytes)
		ThresholdSize: 10,

		// 20mb -- we should check what the largest ones are... might be bigger
		MaxByteSize: 20 * 1024 * 1024,

		ReduceSpec: func(obj runtime.Object) error {
			data, ok := obj.(*dataset.Dataset)
			if !ok {
				return fmt.Errorf("unable to convert value to dataset")
			}

			if len(data.Spec.Data) < 1 {
				return fmt.Errorf("missing frame data")
			}

			data.SetManagedFields(nil) // this could be bigger than the object!
			data.Spec.Data = nil
			return nil
		},

		RebuildSpec: func(obj runtime.Object, blob []byte) error {
			data, ok := obj.(*dataset.Dataset)
			if !ok {
				return fmt.Errorf("expected dataset")
			}
			return json.Unmarshal(blob, &data.Spec)
		},
	}
}
