package folder

import (
	"context"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

func listFolderKeys(ctx context.Context, keys keysapi.Lister) ([]runtime.Object, string, error) {
	listRV, seq := keys.ListKeys(ctx)
	var out []runtime.Object
	for key, err := range seq {
		if err != nil {
			// A partial snapshot would report the remaining folders as deleted.
			return nil, "", err
		}
		out = append(out, &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{
			Namespace:       key.Namespace,
			Name:            key.Name,
			ResourceVersion: key.ResourceVersion,
		}})
	}
	return out, strconv.FormatInt(listRV, 10), nil
}
