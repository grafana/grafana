package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// region TimeInterval

// +genclient
// +k8s:openapi-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TimeInterval struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`
	Spec              TimeIntervalSpec `json:"spec"`
}

func (o *TimeInterval) GetSpec() any {
	return o.Spec
}

func (o *TimeInterval) SetSpec(spec any) error {
	cast, ok := spec.(TimeIntervalSpec)
	if !ok {
		return fmt.Errorf("cannot set spec type %#v, not of type Spec", spec)
	}
	o.Spec = cast
	return nil
}

func (o *TimeInterval) GetCreatedBy() string {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	return o.ObjectMeta.Annotations["grafana.com/createdBy"]
}

func (o *TimeInterval) SetCreatedBy(createdBy string) {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	o.ObjectMeta.Annotations["grafana.com/createdBy"] = createdBy
}

func (o *TimeInterval) GetUpdateTimestamp() time.Time {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	parsed, _ := time.Parse(time.RFC3339, o.ObjectMeta.Annotations["grafana.com/updateTimestamp"])
	return parsed
}

func (o *TimeInterval) SetUpdateTimestamp(updateTimestamp time.Time) {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	o.ObjectMeta.Annotations["grafana.com/updateTimestamp"] = updateTimestamp.Format(time.RFC3339)
}

func (o *TimeInterval) GetUpdatedBy() string {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	return o.ObjectMeta.Annotations["grafana.com/updatedBy"]
}

func (o *TimeInterval) SetUpdatedBy(updatedBy string) {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	o.ObjectMeta.Annotations["grafana.com/updatedBy"] = updatedBy
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:openapi-gen=true
type TimeIntervalList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`
	Items           []TimeInterval `json:"items"`
}

// endregion

// region Receivers

// +genclient
// +k8s:openapi-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Receiver struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`
	Spec              ReceiverSpec `json:"spec"`
}

func (o *Receiver) GetSpec() any {
	return o.Spec
}

func (o *Receiver) SetSpec(spec any) error {
	cast, ok := spec.(ReceiverSpec)
	if !ok {
		return fmt.Errorf("cannot set spec type %#v, not of type Spec", spec)
	}
	o.Spec = cast
	return nil
}

func (o *Receiver) GetCreatedBy() string {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	return o.ObjectMeta.Annotations["grafana.com/createdBy"]
}

func (o *Receiver) SetCreatedBy(createdBy string) {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	o.ObjectMeta.Annotations["grafana.com/createdBy"] = createdBy
}

func (o *Receiver) GetUpdateTimestamp() time.Time {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	parsed, _ := time.Parse(time.RFC3339, o.ObjectMeta.Annotations["grafana.com/updateTimestamp"])
	return parsed
}

func (o *Receiver) SetUpdateTimestamp(updateTimestamp time.Time) {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	o.ObjectMeta.Annotations["grafana.com/updateTimestamp"] = updateTimestamp.Format(time.RFC3339)
}

func (o *Receiver) GetUpdatedBy() string {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	return o.ObjectMeta.Annotations["grafana.com/updatedBy"]
}

func (o *Receiver) SetUpdatedBy(updatedBy string) {
	if o.ObjectMeta.Annotations == nil {
		o.ObjectMeta.Annotations = make(map[string]string)
	}

	o.ObjectMeta.Annotations["grafana.com/updatedBy"] = updatedBy
}

// +k8s:openapi-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ReceiverList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`
	Items           []Receiver `json:"items"`
}

// endregion

// region Templates

// +genclient
// +k8s:openapi-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TemplateGroup struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`
	Spec              TemplateGroupSpec `json:"spec"`
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

// +k8s:openapi-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type TemplateGroupList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`
	Items           []TemplateGroup `json:"items"`
}

// endregion
