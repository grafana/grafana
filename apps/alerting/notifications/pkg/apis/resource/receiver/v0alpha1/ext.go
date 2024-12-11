package v0alpha1

import (
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apiserver/pkg/registry/generic"

	"github.com/grafana/grafana/apps/alerting/common"
)

func (o *Receiver) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	s, ok := o.Annotations[common.ProvenanceStatusAnnotationKey]
	if !ok || s == "" {
		return common.ProvenanceStatusNone
	}
	return s
}

func (o *Receiver) SetProvenanceStatus(status string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if status == "" {
		status = common.ProvenanceStatusNone
	}
	o.Annotations[common.ProvenanceStatusAnnotationKey] = status
}

func (o *Receiver) SetAccessControl(action string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	o.Annotations[AccessControlAnnotation(action)] = "true"
}

// AccessControlAnnotation returns the key for the access control annotation for the given action.
// Ex. grafana.com/access/canDelete.
func AccessControlAnnotation(action string) string {
	return fmt.Sprintf("%s%s/%s", common.InternalPrefix, "access", action)
}

func (o *Receiver) SetInUse(routesCnt int, rules []string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 2)
	}
	o.Annotations[InUseAnnotation("routes")] = fmt.Sprintf("%d", routesCnt)
	o.Annotations[InUseAnnotation("rules")] = fmt.Sprintf("%d", len(rules))
}

// InUseAnnotation returns the key for the in-use annotation for the given resource.
// Ex. grafana.com/inUse/routes, grafana.com/inUse/rules.
func InUseAnnotation(resource string) string {
	return fmt.Sprintf("%s%s/%s", common.InternalPrefix, "inUse", resource)
}

func SelectableFields(obj *Receiver) fields.Set {
	if obj == nil {
		return nil
	}
	selectable := Schema().SelectableFields()
	set := make(fields.Set, len(selectable))
	for _, field := range selectable {
		f, err := field.FieldValueFunc(obj)
		if err != nil {
			continue
		}
		set[field.FieldSelector] = f
	}
	return generic.MergeFieldsSets(generic.ObjectMetaFieldsSet(&obj.ObjectMeta, false), set)
}
