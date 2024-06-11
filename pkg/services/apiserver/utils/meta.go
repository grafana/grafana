package utils

import (
	"fmt"
	"reflect"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// Annotation keys

const AnnoKeyCreatedBy = "grafana.app/createdBy"
const AnnoKeyUpdatedTimestamp = "grafana.app/updatedTimestamp"
const AnnoKeyUpdatedBy = "grafana.app/updatedBy"
const AnnoKeyFolder = "grafana.app/folder"
const AnnoKeySlug = "grafana.app/slug"

// Identify where values came from

const AnnoKeyOriginName = "grafana.app/originName"
const AnnoKeyOriginPath = "grafana.app/originPath"
const AnnoKeyOriginKey = "grafana.app/originKey"
const AnnoKeyOriginTimestamp = "grafana.app/originTimestamp"

// ResourceOriginInfo is saved in annotations.  This is used to identify where the resource came from
// This object can model the same data as our existing provisioning table or a more general git sync
type ResourceOriginInfo struct {
	// Name of the origin/provisioning source
	Name string `json:"name,omitempty"`

	// The path within the named origin above (external_id in the existing dashboard provisioing)
	Path string `json:"path,omitempty"`

	// Verification/identification key (check_sum in existing dashboard provisioning)
	Key string `json:"key,omitempty"`

	// Origin modification timestamp when the resource was saved
	// This will be before the resource updated time
	Timestamp *time.Time `json:"time,omitempty"`

	// Avoid extending
	_ any `json:"-"`
}

// Accessor functions for k8s objects
type GrafanaResourceMetaAccessor interface {
	metav1.Object
	metav1.Type

	GetUpdatedTimestamp() (*time.Time, error)
	SetUpdatedTimestamp(v *time.Time)
	SetUpdatedTimestampMillis(unix int64)
	GetCreatedBy() string
	SetCreatedBy(user string)
	GetUpdatedBy() string
	SetUpdatedBy(user string)
	GetFolder() string
	SetFolder(uid string)
	GetSlug() string
	SetSlug(v string)

	GetOriginInfo() (*ResourceOriginInfo, error)
	SetOriginInfo(info *ResourceOriginInfo)
	GetOriginName() string
	GetOriginPath() string
	GetOriginKey() string
	GetOriginTimestamp() (*time.Time, error)

	// Find a title in the object
	// This will reflect the object and try to get:
	//  * spec.title
	//  * spec.name
	//  * title
	// and return an empty string if nothing was found
	FindTitle(defaultTitle string) string
}

var _ GrafanaResourceMetaAccessor = (*grafanaResourceMetaAccessor)(nil)

type grafanaResourceMetaAccessor struct {
	raw interface{} // the original object (it implements metav1.Object)
	obj metav1.Object
	typ metav1.Type
}

// Accessor takes an arbitrary object pointer and returns meta.Interface.
// obj must be a pointer to an API type. An error is returned if the minimum
// required fields are missing. Fields that are not required return the default
// value and are a no-op if set.
func MetaAccessor(raw interface{}) (GrafanaResourceMetaAccessor, error) {
	obj, err := meta.Accessor(raw)
	if err != nil {
		return nil, err
	}
	typ, ok := raw.(metav1.Type)
	if !ok {
		typ, ok = obj.(metav1.Type)
	}
	if !ok {
		return nil, fmt.Errorf("expecting the object to be a type")
	}
	return &grafanaResourceMetaAccessor{raw, obj, typ}, nil
}

func (m *grafanaResourceMetaAccessor) Object() metav1.Object {
	return m.obj
}

func (m *grafanaResourceMetaAccessor) set(key string, val string) {
	anno := m.obj.GetAnnotations()
	if val == "" {
		if anno != nil {
			delete(anno, key)
		}
	} else {
		if anno == nil {
			anno = make(map[string]string)
		}
		anno[key] = val
	}
	m.obj.SetAnnotations(anno)
}

func (m *grafanaResourceMetaAccessor) get(key string) string {
	return m.obj.GetAnnotations()[key]
}

func (m *grafanaResourceMetaAccessor) GetUpdatedTimestamp() (*time.Time, error) {
	v, ok := m.obj.GetAnnotations()[AnnoKeyUpdatedTimestamp]
	if !ok || v == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil, fmt.Errorf("invalid updated timestamp: %s", err.Error())
	}
	t = t.UTC()
	return &t, nil
}

func (m *grafanaResourceMetaAccessor) SetUpdatedTimestampMillis(v int64) {
	if v > 0 {
		t := time.UnixMilli(v)
		m.SetUpdatedTimestamp(&t)
	} else {
		m.set(AnnoKeyUpdatedTimestamp, "") // will clear the annotation
	}
}

func (m *grafanaResourceMetaAccessor) SetUpdatedTimestamp(v *time.Time) {
	txt := ""
	if v != nil && v.Unix() != 0 {
		txt = v.UTC().Format(time.RFC3339)
	}
	m.set(AnnoKeyUpdatedTimestamp, txt)
}

func (m *grafanaResourceMetaAccessor) GetCreatedBy() string {
	return m.get(AnnoKeyCreatedBy)
}

func (m *grafanaResourceMetaAccessor) SetCreatedBy(user string) {
	m.set(AnnoKeyCreatedBy, user)
}

func (m *grafanaResourceMetaAccessor) GetUpdatedBy() string {
	return m.get(AnnoKeyUpdatedBy)
}

func (m *grafanaResourceMetaAccessor) SetUpdatedBy(user string) {
	m.set(AnnoKeyUpdatedBy, user)
}

func (m *grafanaResourceMetaAccessor) GetFolder() string {
	return m.get(AnnoKeyFolder)
}

func (m *grafanaResourceMetaAccessor) SetFolder(uid string) {
	m.set(AnnoKeyFolder, uid)
}

func (m *grafanaResourceMetaAccessor) GetSlug() string {
	return m.get(AnnoKeySlug)
}

func (m *grafanaResourceMetaAccessor) SetSlug(v string) {
	m.set(AnnoKeySlug, v)
}

func (m *grafanaResourceMetaAccessor) SetOriginInfo(info *ResourceOriginInfo) {
	anno := m.obj.GetAnnotations()
	if anno == nil {
		if info == nil {
			return
		}
		anno = make(map[string]string, 0)
	}

	delete(anno, AnnoKeyOriginName)
	delete(anno, AnnoKeyOriginPath)
	delete(anno, AnnoKeyOriginKey)
	delete(anno, AnnoKeyOriginTimestamp)
	if info != nil && info.Name != "" {
		anno[AnnoKeyOriginName] = info.Name
		if info.Path != "" {
			anno[AnnoKeyOriginPath] = info.Path
		}
		if info.Key != "" {
			anno[AnnoKeyOriginKey] = info.Key
		}
		if info.Timestamp != nil {
			anno[AnnoKeyOriginTimestamp] = info.Timestamp.UTC().Format(time.RFC3339)
		}
	}
	m.obj.SetAnnotations(anno)
}

func (m *grafanaResourceMetaAccessor) GetOriginInfo() (*ResourceOriginInfo, error) {
	v, ok := m.obj.GetAnnotations()[AnnoKeyOriginName]
	if !ok {
		return nil, nil
	}
	t, err := m.GetOriginTimestamp()
	return &ResourceOriginInfo{
		Name:      v,
		Path:      m.GetOriginPath(),
		Key:       m.GetOriginKey(),
		Timestamp: t,
	}, err
}

func (m *grafanaResourceMetaAccessor) GetOriginName() string {
	return m.get(AnnoKeyOriginName)
}

func (m *grafanaResourceMetaAccessor) GetOriginPath() string {
	return m.get(AnnoKeyOriginPath)
}

func (m *grafanaResourceMetaAccessor) GetOriginKey() string {
	return m.get(AnnoKeyOriginKey)
}

func (m *grafanaResourceMetaAccessor) GetOriginTimestamp() (*time.Time, error) {
	v, ok := m.obj.GetAnnotations()[AnnoKeyOriginTimestamp]
	if !ok || v == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil, fmt.Errorf("invalid origin timestamp: %s", err.Error())
	}
	return &t, nil
}

// GetAnnotations implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetAnnotations() map[string]string {
	return m.obj.GetAnnotations()
}

// GetCreationTimestamp implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetCreationTimestamp() metav1.Time {
	return m.obj.GetCreationTimestamp()
}

// GetDeletionGracePeriodSeconds implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetDeletionGracePeriodSeconds() *int64 {
	return m.obj.GetDeletionGracePeriodSeconds()
}

// GetDeletionTimestamp implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetDeletionTimestamp() *metav1.Time {
	return m.obj.GetDeletionTimestamp()
}

// GetFinalizers implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetFinalizers() []string {
	return m.obj.GetFinalizers()
}

// GetGenerateName implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetGenerateName() string {
	return m.obj.GetGenerateName()
}

// GetGeneration implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetGeneration() int64 {
	return m.obj.GetGeneration()
}

// GetLabels implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetLabels() map[string]string {
	return m.obj.GetLabels()
}

// GetManagedFields implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetManagedFields() []metav1.ManagedFieldsEntry {
	return m.obj.GetManagedFields()
}

// GetName implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetName() string {
	return m.obj.GetName()
}

// GetNamespace implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetNamespace() string {
	return m.obj.GetNamespace()
}

// GetOwnerReferences implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetOwnerReferences() []metav1.OwnerReference {
	return m.obj.GetOwnerReferences()
}

// GetResourceVersion implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetResourceVersion() string {
	return m.obj.GetResourceVersion()
}

// GetSelfLink implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetSelfLink() string {
	return m.obj.GetSelfLink()
}

// GetUID implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) GetUID() types.UID {
	return m.obj.GetUID()
}

// SetAnnotations implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetAnnotations(annotations map[string]string) {
	m.obj.SetAnnotations(annotations)
}

// SetCreationTimestamp implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetCreationTimestamp(timestamp metav1.Time) {
	m.obj.SetCreationTimestamp(timestamp)
}

// SetDeletionGracePeriodSeconds implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetDeletionGracePeriodSeconds(v *int64) {
	m.obj.SetDeletionGracePeriodSeconds(v)
}

// SetDeletionTimestamp implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetDeletionTimestamp(timestamp *metav1.Time) {
	m.obj.SetDeletionTimestamp(timestamp)
}

// SetFinalizers implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetFinalizers(finalizers []string) {
	m.obj.SetFinalizers(finalizers)
}

// SetGenerateName implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetGenerateName(name string) {
	m.obj.SetGenerateName(name)
}

// SetGeneration implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetGeneration(generation int64) {
	m.obj.SetGeneration(generation)
}

// SetLabels implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetLabels(labels map[string]string) {
	m.obj.SetLabels(labels)
}

// SetManagedFields implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetManagedFields(managedFields []metav1.ManagedFieldsEntry) {
	m.obj.SetManagedFields(managedFields)
}

// SetName implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetName(name string) {
	m.obj.SetName(name)
}

// SetNamespace implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetNamespace(namespace string) {
	m.obj.SetNamespace(namespace)
}

// SetOwnerReferences implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetOwnerReferences(v []metav1.OwnerReference) {
	m.obj.SetOwnerReferences(v)
}

// SetResourceVersion implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetResourceVersion(version string) {
	m.obj.SetResourceVersion(version)
}

// SetSelfLink implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetSelfLink(selfLink string) {
	m.obj.SetSelfLink(selfLink)
}

// SetUID implements GrafanaResourceMetaAccessor.
func (m *grafanaResourceMetaAccessor) SetUID(uid types.UID) {
	m.obj.SetUID(uid)
}

func (m *grafanaResourceMetaAccessor) GetAPIVersion() string {
	return m.typ.GetAPIVersion()
}

func (m *grafanaResourceMetaAccessor) SetAPIVersion(version string) {
	m.typ.SetAPIVersion(version)
}

func (m *grafanaResourceMetaAccessor) GetKind() string {
	return m.typ.GetKind()
}

func (m *grafanaResourceMetaAccessor) SetKind(kind string) {
	m.typ.SetKind(kind)
}

func (m *grafanaResourceMetaAccessor) FindTitle(defaultTitle string) string {
	// look for Spec.Title or Spec.Name
	r := reflect.ValueOf(m.raw)
	if r.Kind() == reflect.Ptr || r.Kind() == reflect.Interface {
		r = r.Elem()
	}
	if r.Kind() == reflect.Struct {
		spec := r.FieldByName("Spec")
		if spec.Kind() == reflect.Struct {
			title := spec.FieldByName("Title")
			if title.IsValid() && title.Kind() == reflect.String {
				return title.String()
			}
			name := spec.FieldByName("Name")
			if name.IsValid() && name.Kind() == reflect.String {
				return name.String()
			}
		}

		title := r.FieldByName("Title")
		if title.IsValid() && title.Kind() == reflect.String {
			return title.String()
		}
	}
	return defaultTitle
}
