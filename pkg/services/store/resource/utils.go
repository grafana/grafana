package resource

import (
	"fmt"
	"strconv"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ObjectKey creates a key for a given object
func ObjectKey(gr schema.GroupResource, obj metav1.Object) (*Key, error) {
	if gr.Group == "" {
		return nil, fmt.Errorf("missing group")
	}
	if gr.Resource == "" {
		return nil, fmt.Errorf("missing resource")
	}
	if obj.GetName() == "" {
		return nil, fmt.Errorf("object is missing name")
	}
	key := &Key{
		Group:     gr.Group,
		Resource:  gr.Resource,
		Namespace: obj.GetNamespace(),
		Name:      obj.GetName(),
	}
	if obj.GetResourceVersion() != "" {
		var err error
		key.ResourceVersion, err = strconv.ParseInt(obj.GetResourceVersion(), 10, 64)
		if err != nil {
			return nil, fmt.Errorf("storage requires numeric revision version %w", err)
		}
	}
	return key, nil
}
