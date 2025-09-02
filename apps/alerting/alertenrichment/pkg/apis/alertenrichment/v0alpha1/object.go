package v0alpha1

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// App Platform resource.Object interface methods for AlertEnrichment

func (o *AlertEnrichment) GetSpec() any {
	return o.Spec
}

func (o *AlertEnrichment) SetSpec(spec any) error {
	cast, ok := spec.(AlertEnrichmentSpec)
	if !ok {
		return fmt.Errorf("cannot set spec type %#v, not of type AlertEnrichmentSpec", spec)
	}
	o.Spec = cast
	return nil
}

func (o *AlertEnrichment) GetSubresources() map[string]any {
	return map[string]any{}
}

func (o *AlertEnrichment) GetSubresource(name string) (any, bool) {
	return nil, false
}

func (o *AlertEnrichment) SetSubresource(name string, value any) error {
	return fmt.Errorf("subresource %s does not exist", name)
}

func (o *AlertEnrichment) Copy() resource.Object {
	return resource.CopyObject(o)
}

func (o *AlertEnrichment) GetStaticMetadata() resource.StaticMetadata {
	gvk := o.GroupVersionKind()
	return resource.StaticMetadata{
		Name:      o.Name,
		Namespace: o.Namespace,
		Group:     gvk.Group,
		Version:   gvk.Version,
		Kind:      gvk.Kind,
	}
}

func (o *AlertEnrichment) SetStaticMetadata(metadata resource.StaticMetadata) {
	o.Name = metadata.Name
	o.Namespace = metadata.Namespace
	o.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   metadata.Group,
		Version: metadata.Version,
		Kind:    metadata.Kind,
	})
}

func (o *AlertEnrichment) GetCommonMetadata() resource.CommonMetadata {
	dt := o.DeletionTimestamp
	var deletionTimestamp *time.Time
	if dt != nil {
		deletionTimestamp = &dt.Time
	}
	// Legacy ExtraFields support
	extraFields := make(map[string]any)
	if o.Annotations != nil {
		extraFields["annotations"] = o.Annotations
	}
	if o.ManagedFields != nil {
		extraFields["managedFields"] = o.ManagedFields
	}
	if o.OwnerReferences != nil {
		extraFields["ownerReferences"] = o.OwnerReferences
	}
	return resource.CommonMetadata{
		UID:               string(o.UID),
		ResourceVersion:   o.ResourceVersion,
		Generation:        o.Generation,
		Labels:            o.Labels,
		CreationTimestamp: o.CreationTimestamp.Time,
		DeletionTimestamp: deletionTimestamp,
		Finalizers:        o.Finalizers,
		UpdateTimestamp:   o.GetUpdateTimestamp(),
		CreatedBy:         o.GetCreatedBy(),
		UpdatedBy:         o.GetUpdatedBy(),
		ExtraFields:       extraFields,
	}
}

func (o *AlertEnrichment) SetCommonMetadata(metadata resource.CommonMetadata) {
	o.UID = types.UID(metadata.UID)
	o.ResourceVersion = metadata.ResourceVersion
	o.Generation = metadata.Generation
	o.Labels = metadata.Labels
	o.CreationTimestamp = metav1.NewTime(metadata.CreationTimestamp)
	if metadata.DeletionTimestamp != nil {
		dt := metav1.NewTime(*metadata.DeletionTimestamp)
		o.DeletionTimestamp = &dt
	} else {
		o.DeletionTimestamp = nil
	}
	o.Finalizers = metadata.Finalizers
	if o.Annotations == nil {
		o.Annotations = make(map[string]string)
	}
	if !metadata.UpdateTimestamp.IsZero() {
		o.SetUpdateTimestamp(metadata.UpdateTimestamp)
	}
	if metadata.CreatedBy != "" {
		o.SetCreatedBy(metadata.CreatedBy)
	}
	if metadata.UpdatedBy != "" {
		o.SetUpdatedBy(metadata.UpdatedBy)
	}
	// Legacy support for setting Annotations, ManagedFields, and OwnerReferences via ExtraFields
	if metadata.ExtraFields != nil {
		if annotations, ok := metadata.ExtraFields["annotations"].(map[string]string); ok {
			o.Annotations = annotations
		}
		if managedFields, ok := metadata.ExtraFields["managedFields"].([]metav1.ManagedFieldsEntry); ok {
			o.ManagedFields = managedFields
		}
		if ownerReferences, ok := metadata.ExtraFields["ownerReferences"].([]metav1.OwnerReference); ok {
			o.OwnerReferences = ownerReferences
		}
	}
}

func (o *AlertEnrichment) GetCreatedBy() string {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string)
	}
	return o.Annotations["grafana.com/createdBy"]
}

func (o *AlertEnrichment) SetCreatedBy(createdBy string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string)
	}
	o.Annotations["grafana.com/createdBy"] = createdBy
}

func (o *AlertEnrichment) GetUpdateTimestamp() time.Time {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string)
	}
	parsed, _ := time.Parse(time.RFC3339, o.Annotations["grafana.com/updateTimestamp"])
	return parsed
}

func (o *AlertEnrichment) SetUpdateTimestamp(updateTimestamp time.Time) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string)
	}
	o.Annotations["grafana.com/updateTimestamp"] = updateTimestamp.Format(time.RFC3339)
}

func (o *AlertEnrichment) GetUpdatedBy() string {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string)
	}
	return o.Annotations["grafana.com/updatedBy"]
}

func (o *AlertEnrichment) SetUpdatedBy(updatedBy string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string)
	}
	o.Annotations["grafana.com/updatedBy"] = updatedBy
}

// AlertEnrichmentList also needs to implement resource.ListObject
func (o *AlertEnrichmentList) Copy() resource.ListObject {
	cpy := &AlertEnrichmentList{
		TypeMeta: o.TypeMeta,
		Items:    make([]AlertEnrichment, len(o.Items)),
	}
	o.ListMeta.DeepCopyInto(&cpy.ListMeta)
	for i := 0; i < len(o.Items); i++ {
		o.Items[i].DeepCopyInto(&cpy.Items[i])
	}
	return cpy
}

func (o *AlertEnrichmentList) GetItems() []resource.Object {
	items := make([]resource.Object, len(o.Items))
	for i, item := range o.Items {
		items[i] = &item
	}
	return items
}

func (o *AlertEnrichmentList) SetItems(items []resource.Object) {
	o.Items = make([]AlertEnrichment, len(items))
	for i, item := range items {
		if ae, ok := item.(*AlertEnrichment); ok {
			o.Items[i] = *ae
		}
	}
}
