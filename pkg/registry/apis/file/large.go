package file

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	file "github.com/grafana/grafana/pkg/apis/file/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

func NewFileLargeObjectSupport(scheme *runtime.Scheme) *apistore.BasicLargeObjectSupport {
	return &apistore.BasicLargeObjectSupport{
		TheGroupResource: file.FileResourceInfo.GroupResource(),

		// byte size, while testing lets do almost everything (10bytes)
		ThresholdSize: 10,

		// 20mb -- we should check what the largest ones are... might be bigger
		MaxByteSize: 20 * 1024 * 1024,

		ReduceSpec: func(obj runtime.Object) error {
			data, ok := obj.(*file.File)
			if !ok {
				return fmt.Errorf("unable to convert value to file")
			}

			if len(data.Spec.Data) < 1 {
				return fmt.Errorf("missing file data")
			}

			data.SetManagedFields(nil) // this could be bigger than the object!
			data.Spec.Data = nil
			return nil
		},

		RebuildSpec: func(obj runtime.Object, blob []byte) error {
			data, ok := obj.(*file.File)
			if !ok {
				return fmt.Errorf("expected file")
			}
			return json.Unmarshal(blob, &data.Spec)
		},
	}
}
