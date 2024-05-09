package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TemplateGroup struct {
	metav1.TypeMeta     `json:",inline"`
	metav1.ObjectMeta   `json:"metadata"`
	Spec                TemplateGroupSpec   `json:"spec"`
	TemplateGroupStatus TemplateGroupStatus `json:"status"`
}

func (o *TemplateGroup) GetSpec() any {
	return o.Spec
}

func (o *TemplateGroup) SetSpec(spec any) error {
	cast, ok := spec.(TemplateGroupSpec)
	if !ok {
		return fmt.Errorf("cannot set spec type %#v, not of type Spec", spec)
	}
	o.Spec = cast
	return nil
}

func (o *TemplateGroup) GetSubresources() map[string]any {
	return map[string]any{
		"status": o.TemplateGroupStatus,
	}
}

func (o *TemplateGroup) GetSubresource(name string) (any, bool) {
	switch name {
	case "status":
		return o.TemplateGroupStatus, true
	default:
		return nil, false
	}
}

func (o *TemplateGroup) SetSubresource(name string, value any) error {
	switch name {
	case "status":
		cast, ok := value.(TemplateGroupStatus)
		if !ok {
			return fmt.Errorf("cannot set status type %#v, not of type TemplateGroupStatus", value)
		}
		o.TemplateGroupStatus = cast
		return nil
	default:
		return fmt.Errorf("subresource '%s' does not exist", name)
	}
}

func (o *TemplateGroup) GetCreatedBy() string {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	return o.ObjectMeta.Annotations["grafana.com/createdBy"]
}

func (o *TemplateGroup) SetCreatedBy(createdBy string) {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	o.ObjectMeta.Annotations["grafana.com/createdBy"] = createdBy
}

func (o *TemplateGroup) GetUpdateTimestamp() time.Time {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	parsed, _ := time.Parse(o.ObjectMeta.Annotations["grafana.com/updateTimestamp"], time.RFC3339)
	return parsed
}

func (o *TemplateGroup) SetUpdateTimestamp(updateTimestamp time.Time) {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	o.ObjectMeta.Annotations["grafana.com/updateTimestamp"] = updateTimestamp.Format(time.RFC3339)
}

func (o *TemplateGroup) GetUpdatedBy() string {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	return o.ObjectMeta.Annotations["grafana.com/updatedBy"]
}

func (o *TemplateGroup) SetUpdatedBy(updatedBy string) {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	o.ObjectMeta.Annotations["grafana.com/updatedBy"] = updatedBy
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TemplateGroupList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`
	Items           []TemplateGroup `json:"items"`
}
