package folder

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

func listFolderKeys(ctx context.Context, keys keysapi.Lister) ([]runtime.Object, int64, error) {
	listRV, seq := keys.ListKeys(ctx)
	var out []runtime.Object
	for key, err := range seq {
		if err != nil {
			// A partial snapshot would report the remaining folders as deleted.
			return nil, 0, err
		}
		out = append(out, &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{
			Namespace:       key.Namespace,
			Name:            key.Name,
			ResourceVersion: key.ResourceVersion,
		}})
	}
	return out, listRV, nil
}
