package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana-app-sdk/resource"
)

// This file makes the hand-written provisioning types usable as app-sdk resource.Object kinds,
// so the app-sdk installer can serve them without regenerating the Go types from CUE.

const (
	annotationCreatedBy       = "grafana.com/createdBy"
	annotationUpdatedBy       = "grafana.com/updatedBy"
	annotationUpdateTimestamp = "grafana.com/updateTimestamp"
)

type objectMeta interface {
	metav1.Object
	schema.ObjectKind
}

func staticMetadataOf(o objectMeta) resource.StaticMetadata {
	gvk := o.GroupVersionKind()
	return resource.StaticMetadata{
		Name:      o.GetName(),
		Namespace: o.GetNamespace(),
		Group:     gvk.Group,
		Version:   gvk.Version,
		Kind:      gvk.Kind,
	}
}

func setStaticMetadata(o objectMeta, m resource.StaticMetadata) {
	o.SetName(m.Name)
	o.SetNamespace(m.Namespace)
	o.SetGroupVersionKind(schema.GroupVersionKind{Group: m.Group, Version: m.Version, Kind: m.Kind})
}

func commonMetadataOf(o objectMeta) resource.CommonMetadata {
	var deletionTimestamp *time.Time
	if dt := o.GetDeletionTimestamp(); dt != nil {
		deletionTimestamp = &dt.Time
	}
	extraFields := map[string]any{}
	if a := o.GetAnnotations(); a != nil {
		extraFields["annotations"] = a
	}
	if m := o.GetManagedFields(); m != nil {
		extraFields["managedFields"] = m
	}
	if r := o.GetOwnerReferences(); r != nil {
		extraFields["ownerReferences"] = r
	}
	updated, _ := time.Parse(time.RFC3339, o.GetAnnotations()[annotationUpdateTimestamp])
	return resource.CommonMetadata{
		UID:               string(o.GetUID()),
		ResourceVersion:   o.GetResourceVersion(),
		Generation:        o.GetGeneration(),
		Labels:            o.GetLabels(),
		CreationTimestamp: o.GetCreationTimestamp().Time,
		DeletionTimestamp: deletionTimestamp,
		Finalizers:        o.GetFinalizers(),
		UpdateTimestamp:   updated,
		CreatedBy:         o.GetAnnotations()[annotationCreatedBy],
		UpdatedBy:         o.GetAnnotations()[annotationUpdatedBy],
		ExtraFields:       extraFields,
	}
}

func setCommonMetadata(o objectMeta, m resource.CommonMetadata) {
	o.SetUID(types.UID(m.UID))
	o.SetResourceVersion(m.ResourceVersion)
	o.SetGeneration(m.Generation)
	o.SetLabels(m.Labels)
	o.SetCreationTimestamp(metav1.NewTime(m.CreationTimestamp))
	if m.DeletionTimestamp != nil {
		dt := metav1.NewTime(*m.DeletionTimestamp)
		o.SetDeletionTimestamp(&dt)
	} else {
		o.SetDeletionTimestamp(nil)
	}
	o.SetFinalizers(m.Finalizers)

	annotations := o.GetAnnotations()
	if annotations == nil {
		annotations = map[string]string{}
	}
	if !m.UpdateTimestamp.IsZero() {
		annotations[annotationUpdateTimestamp] = m.UpdateTimestamp.Format(time.RFC3339)
	}
	if m.CreatedBy != "" {
		annotations[annotationCreatedBy] = m.CreatedBy
	}
	if m.UpdatedBy != "" {
		annotations[annotationUpdatedBy] = m.UpdatedBy
	}
	if extra, ok := m.ExtraFields["annotations"].(map[string]string); ok {
		annotations = extra
	}
	o.SetAnnotations(annotations)
	if mf, ok := m.ExtraFields["managedFields"].([]metav1.ManagedFieldsEntry); ok {
		o.SetManagedFields(mf)
	}
	if or, ok := m.ExtraFields["ownerReferences"].([]metav1.OwnerReference); ok {
		o.SetOwnerReferences(or)
	}
}

func specTypeError(spec any, want string) error {
	return fmt.Errorf("cannot set spec type %#v, not of type %s", spec, want)
}

// Repository

func (o *Repository) GetSpec() any { return o.Spec }

func (o *Repository) SetSpec(spec any) error {
	cast, ok := spec.(RepositorySpec)
	if !ok {
		return specTypeError(spec, "RepositorySpec")
	}
	o.Spec = cast
	return nil
}

func (o *Repository) GetSubresources() map[string]any {
	return map[string]any{"status": o.Status}
}

func (o *Repository) GetSubresource(name string) (any, bool) {
	if name == "status" {
		return o.Status, true
	}
	return nil, false
}

func (o *Repository) SetSubresource(name string, value any) error {
	if name != "status" {
		return fmt.Errorf("subresource '%s' does not exist", name)
	}
	cast, ok := value.(RepositoryStatus)
	if !ok {
		return fmt.Errorf("cannot set status type %#v, not of type RepositoryStatus", value)
	}
	o.Status = cast
	return nil
}

func (o *Repository) GetStaticMetadata() resource.StaticMetadata  { return staticMetadataOf(o) }
func (o *Repository) SetStaticMetadata(m resource.StaticMetadata) { setStaticMetadata(o, m) }
func (o *Repository) GetCommonMetadata() resource.CommonMetadata  { return commonMetadataOf(o) }
func (o *Repository) SetCommonMetadata(m resource.CommonMetadata) { setCommonMetadata(o, m) }
func (o *Repository) Copy() resource.Object                       { return o.DeepCopy() }

func (o *RepositoryList) GetItems() []resource.Object {
	items := make([]resource.Object, len(o.Items))
	for i := range o.Items {
		items[i] = &o.Items[i]
	}
	return items
}

func (o *RepositoryList) SetItems(items []resource.Object) {
	o.Items = make([]Repository, len(items))
	for i := range items {
		o.Items[i] = *items[i].(*Repository)
	}
}

func (o *RepositoryList) Copy() resource.ListObject { return o.DeepCopy() }

// Connection

func (o *Connection) GetSpec() any { return o.Spec }

func (o *Connection) SetSpec(spec any) error {
	cast, ok := spec.(ConnectionSpec)
	if !ok {
		return specTypeError(spec, "ConnectionSpec")
	}
	o.Spec = cast
	return nil
}

func (o *Connection) GetSubresources() map[string]any {
	return map[string]any{"status": o.Status}
}

func (o *Connection) GetSubresource(name string) (any, bool) {
	if name == "status" {
		return o.Status, true
	}
	return nil, false
}

func (o *Connection) SetSubresource(name string, value any) error {
	if name != "status" {
		return fmt.Errorf("subresource '%s' does not exist", name)
	}
	cast, ok := value.(ConnectionStatus)
	if !ok {
		return fmt.Errorf("cannot set status type %#v, not of type ConnectionStatus", value)
	}
	o.Status = cast
	return nil
}

func (o *Connection) GetStaticMetadata() resource.StaticMetadata  { return staticMetadataOf(o) }
func (o *Connection) SetStaticMetadata(m resource.StaticMetadata) { setStaticMetadata(o, m) }
func (o *Connection) GetCommonMetadata() resource.CommonMetadata  { return commonMetadataOf(o) }
func (o *Connection) SetCommonMetadata(m resource.CommonMetadata) { setCommonMetadata(o, m) }
func (o *Connection) Copy() resource.Object                       { return o.DeepCopy() }

func (o *ConnectionList) GetItems() []resource.Object {
	items := make([]resource.Object, len(o.Items))
	for i := range o.Items {
		items[i] = &o.Items[i]
	}
	return items
}

func (o *ConnectionList) SetItems(items []resource.Object) {
	o.Items = make([]Connection, len(items))
	for i := range items {
		o.Items[i] = *items[i].(*Connection)
	}
}

func (o *ConnectionList) Copy() resource.ListObject { return o.DeepCopy() }

// Job: status is written through the main resource, so it exposes no subresources.

func (o *Job) GetSpec() any { return o.Spec }

func (o *Job) SetSpec(spec any) error {
	cast, ok := spec.(JobSpec)
	if !ok {
		return specTypeError(spec, "JobSpec")
	}
	o.Spec = cast
	return nil
}

func (o *Job) GetSubresources() map[string]any   { return map[string]any{} }
func (o *Job) GetSubresource(string) (any, bool) { return nil, false }
func (o *Job) SetSubresource(name string, _ any) error {
	return fmt.Errorf("subresource '%s' does not exist", name)
}

func (o *Job) GetStaticMetadata() resource.StaticMetadata  { return staticMetadataOf(o) }
func (o *Job) SetStaticMetadata(m resource.StaticMetadata) { setStaticMetadata(o, m) }
func (o *Job) GetCommonMetadata() resource.CommonMetadata  { return commonMetadataOf(o) }
func (o *Job) SetCommonMetadata(m resource.CommonMetadata) { setCommonMetadata(o, m) }
func (o *Job) Copy() resource.Object                       { return o.DeepCopy() }

func (o *JobList) GetItems() []resource.Object {
	items := make([]resource.Object, len(o.Items))
	for i := range o.Items {
		items[i] = &o.Items[i]
	}
	return items
}

func (o *JobList) SetItems(items []resource.Object) {
	o.Items = make([]Job, len(items))
	for i := range items {
		o.Items[i] = *items[i].(*Job)
	}
}

func (o *JobList) Copy() resource.ListObject { return o.DeepCopy() }

// HistoricJob

func (o *HistoricJob) GetSpec() any { return o.Spec }

func (o *HistoricJob) SetSpec(spec any) error {
	cast, ok := spec.(JobSpec)
	if !ok {
		return specTypeError(spec, "JobSpec")
	}
	o.Spec = cast
	return nil
}

func (o *HistoricJob) GetSubresources() map[string]any   { return map[string]any{} }
func (o *HistoricJob) GetSubresource(string) (any, bool) { return nil, false }
func (o *HistoricJob) SetSubresource(name string, _ any) error {
	return fmt.Errorf("subresource '%s' does not exist", name)
}

func (o *HistoricJob) GetStaticMetadata() resource.StaticMetadata  { return staticMetadataOf(o) }
func (o *HistoricJob) SetStaticMetadata(m resource.StaticMetadata) { setStaticMetadata(o, m) }
func (o *HistoricJob) GetCommonMetadata() resource.CommonMetadata  { return commonMetadataOf(o) }
func (o *HistoricJob) SetCommonMetadata(m resource.CommonMetadata) { setCommonMetadata(o, m) }
func (o *HistoricJob) Copy() resource.Object                       { return o.DeepCopy() }

func (o *HistoricJobList) GetItems() []resource.Object {
	items := make([]resource.Object, len(o.Items))
	for i := range o.Items {
		items[i] = &o.Items[i]
	}
	return items
}

func (o *HistoricJobList) SetItems(items []resource.Object) {
	o.Items = make([]HistoricJob, len(items))
	for i := range items {
		o.Items[i] = *items[i].(*HistoricJob)
	}
}

func (o *HistoricJobList) Copy() resource.ListObject { return o.DeepCopy() }

var (
	_ resource.Object     = (*Repository)(nil)
	_ resource.ListObject = (*RepositoryList)(nil)
	_ resource.Object     = (*Connection)(nil)
	_ resource.ListObject = (*ConnectionList)(nil)
	_ resource.Object     = (*Job)(nil)
	_ resource.ListObject = (*JobList)(nil)
	_ resource.Object     = (*HistoricJob)(nil)
	_ resource.ListObject = (*HistoricJobList)(nil)
)
