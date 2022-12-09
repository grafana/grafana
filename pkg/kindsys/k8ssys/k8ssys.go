package k8ssys

import (
	"fmt"

	"github.com/grafana/grafana/pkg/kindsys"
	k8schema "k8s.io/apimachinery/pkg/runtime/schema"
)

// TODO this could probably be done in CUE/framework
func GVKFor(props kindsys.CoreStructuredProperties) k8schema.GroupVersionKind {
	gvk := k8schema.GroupVersionKind{
		Group: fmt.Sprintf("%s.core.grafana", props.MachineName),
		Kind:  props.Name,
	}
	if props.Maturity.Less(kindsys.MaturityStable) {
		gvk.Version = "v1alpha1"
	} else {
		// Add one because v0 isn't allowed in crd version numbering
		gvk.Version = fmt.Sprintf("v%v", props.CurrentVersion[0]+1)
	}

	return gvk
}
