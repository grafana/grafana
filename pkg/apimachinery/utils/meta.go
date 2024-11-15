package utils

import (
	"bytes"
	"fmt"
	"mime"
	"reflect"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

// Annotation keys

const AnnoKeyCreatedBy = "grafana.app/createdBy"
const AnnoKeyUpdatedTimestamp = "grafana.app/updatedTimestamp"
const AnnoKeyUpdatedBy = "grafana.app/updatedBy"
const AnnoKeyFolder = "grafana.app/folder"
const AnnoKeySlug = "grafana.app/slug"
const AnnoKeyBlob = "grafana.app/blob"
const AnnoKeyMessage = "grafana.app/message"

// Identify where values came from

const AnnoKeyOriginName = "grafana.app/originName"
const AnnoKeyOriginPath = "grafana.app/originPath"
const AnnoKeyOriginHash = "grafana.app/originHash"
const AnnoKeyOriginTimestamp = "grafana.app/originTimestamp"

// #TODO revisit keeping these folder-specific annotations once we have complete support for mode 1

const AnnoKeyFullPath = "grafana.app/fullPath"
const AnnoKeyFullPathUIDs = "grafana.app/fullPathUIDs"

// ResourceOriginInfo is saved in annotations.  This is used to identify where the resource came from
// This object can model the same data as our existing provisioning table or a more general git sync
type ResourceOriginInfo struct {
	// Name of the origin/provisioning source
	Name string `json:"name,omitempty"`

	// The path within the named origin above (external_id in the existing dashboard provisioing)
	Path string `json:"path,omitempty"`

	// Verification/identification hash (check_sum in existing dashboard provisioning)
	Hash string `json:"hash,omitempty"`

	// Origin modification timestamp when the resource was saved
	// This will be before the resource updated time
	Timestamp *time.Time `json:"time,omitempty"`

	// Avoid extending
	_ any `json:"-"`
}

// Accessor functions for k8s objects
type GrafanaMetaAccessor interface {
	metav1.Object

	GetGroupVersionKind() schema.GroupVersionKind
	GetRuntimeObject() (runtime.Object, bool)

	// Helper to get resource versions as int64, however this is not required
	// See: https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions
	GetResourceVersionInt64() (int64, error)
	SetResourceVersionInt64(int64)

	GetUpdatedTimestamp() (*time.Time, error)
	SetUpdatedTimestamp(v *time.Time)
	SetUpdatedTimestampMillis(unix int64)
	GetCreatedBy() string
	SetCreatedBy(user string)
	GetUpdatedBy() string
	SetUpdatedBy(user string)
	GetFolder() string
	SetFolder(uid string)
	GetMessage() string
	SetMessage(msg string)
	SetAnnotation(key string, val string)

	GetSlug() string
	SetSlug(v string)

	SetBlob(v *BlobInfo)
	GetBlob() *BlobInfo

	GetOriginInfo() (*ResourceOriginInfo, error)
	SetOriginInfo(info *ResourceOriginInfo)
	GetOriginName() string
	GetOriginPath() string
	GetOriginHash() string
	GetOriginTimestamp() (*time.Time, error)

	GetSpec() (any, error)
	SetSpec(any) error

	GetStatus() (any, error)

	// Used by the generic strategy to keep the status value unchanged on an update
	// NOTE the type must match the existing value, or an error will be thrown
	SetStatus(any) error

	// Deprecated: this is a temporary hack for folders, it will be removed without notice soon
	GetFullPath() string

	// Deprecated: this is a temporary hack for folders, it will be removed without notice soon
	SetFullPath(path string)

	// Deprecated: this is a temporary hack for folders, it will be removed without notice soon
	GetFullPathUIDs() string

	// Deprecated: this is a temporary hack for folders, it will be removed without notice soon
	SetFullPathUIDs(path string)

	// Find a title in the object
	// This will reflect the object and try to get:
	//  * spec.title
	//  * spec.name
	//  * title
	// and return an empty string if nothing was found
	FindTitle(defaultTitle string) string
}

var _ GrafanaMetaAccessor = (*grafanaMetaAccessor)(nil)

type grafanaMetaAccessor struct {
	raw interface{} // the original object (it implements metav1.Object)
	obj metav1.Object
	r   reflect.Value
}

// Accessor takes an arbitrary object pointer and returns meta.Interface.
// obj must be a pointer to an API type. An error is returned if the minimum
// required fields are missing. Fields that are not required return the default
// value and are a no-op if set.
func MetaAccessor(raw interface{}) (GrafanaMetaAccessor, error) {
	obj, err := meta.Accessor(raw)
	if err != nil {
		return nil, err
	}

	// reflection to find title and other non object properties
	r := reflect.ValueOf(raw)
	if r.Kind() == reflect.Ptr || r.Kind() == reflect.Interface {
		r = r.Elem()
	}
	return &grafanaMetaAccessor{raw, obj, r}, nil
}

func (m *grafanaMetaAccessor) GetResourceVersionInt64() (int64, error) {
	v := m.obj.GetResourceVersion()
	if v == "" {
		return 0, nil
	}
	return strconv.ParseInt(v, 10, 64)
}

func (m *grafanaMetaAccessor) GetRuntimeObject() (runtime.Object, bool) {
	obj, ok := m.raw.(runtime.Object)
	return obj, ok
}

func (m *grafanaMetaAccessor) SetResourceVersionInt64(rv int64) {
	m.obj.SetResourceVersion(strconv.FormatInt(rv, 10))
}

func (m *grafanaMetaAccessor) SetAnnotation(key string, val string) {
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

func (m *grafanaMetaAccessor) get(key string) string {
	return m.obj.GetAnnotations()[key]
}

func (m *grafanaMetaAccessor) GetUpdatedTimestamp() (*time.Time, error) {
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

func (m *grafanaMetaAccessor) SetUpdatedTimestampMillis(v int64) {
	if v > 0 {
		t := time.UnixMilli(v)
		m.SetUpdatedTimestamp(&t)
	} else {
		m.SetAnnotation(AnnoKeyUpdatedTimestamp, "") // will clear the annotation
	}
}

func (m *grafanaMetaAccessor) SetUpdatedTimestamp(v *time.Time) {
	txt := ""
	if v != nil && v.Unix() != 0 {
		txt = v.UTC().Format(time.RFC3339)
	}
	m.SetAnnotation(AnnoKeyUpdatedTimestamp, txt)
}

func (m *grafanaMetaAccessor) GetCreatedBy() string {
	return m.get(AnnoKeyCreatedBy)
}

func (m *grafanaMetaAccessor) SetCreatedBy(user string) {
	m.SetAnnotation(AnnoKeyCreatedBy, user)
}

func (m *grafanaMetaAccessor) GetUpdatedBy() string {
	return m.get(AnnoKeyUpdatedBy)
}

func (m *grafanaMetaAccessor) SetUpdatedBy(user string) {
	m.SetAnnotation(AnnoKeyUpdatedBy, user)
}

func (m *grafanaMetaAccessor) GetBlob() *BlobInfo {
	return ParseBlobInfo(m.get(AnnoKeyBlob))
}

func (m *grafanaMetaAccessor) SetBlob(info *BlobInfo) {
	if info == nil {
		m.SetAnnotation(AnnoKeyBlob, "") // delete
	} else {
		m.SetAnnotation(AnnoKeyBlob, info.String())
	}
}

func (m *grafanaMetaAccessor) GetFolder() string {
	return m.get(AnnoKeyFolder)
}

func (m *grafanaMetaAccessor) SetFolder(uid string) {
	m.SetAnnotation(AnnoKeyFolder, uid)
}

func (m *grafanaMetaAccessor) GetMessage() string {
	return m.get(AnnoKeyMessage)
}

func (m *grafanaMetaAccessor) SetMessage(uid string) {
	m.SetAnnotation(AnnoKeyMessage, uid)
}

func (m *grafanaMetaAccessor) GetSlug() string {
	return m.get(AnnoKeySlug)
}

func (m *grafanaMetaAccessor) SetSlug(v string) {
	m.SetAnnotation(AnnoKeySlug, v)
}

func (m *grafanaMetaAccessor) SetOriginInfo(info *ResourceOriginInfo) {
	anno := m.obj.GetAnnotations()
	if anno == nil {
		if info == nil {
			return
		}
		anno = make(map[string]string, 0)
	}

	delete(anno, AnnoKeyOriginName)
	delete(anno, AnnoKeyOriginPath)
	delete(anno, AnnoKeyOriginHash)
	delete(anno, AnnoKeyOriginTimestamp)
	if info != nil && info.Name != "" {
		anno[AnnoKeyOriginName] = info.Name
		if info.Path != "" {
			anno[AnnoKeyOriginPath] = info.Path
		}
		if info.Hash != "" {
			anno[AnnoKeyOriginHash] = info.Hash
		}
		if info.Timestamp != nil {
			anno[AnnoKeyOriginTimestamp] = info.Timestamp.UTC().Format(time.RFC3339)
		}
	}
	m.obj.SetAnnotations(anno)
}

func (m *grafanaMetaAccessor) GetOriginInfo() (*ResourceOriginInfo, error) {
	v, ok := m.obj.GetAnnotations()[AnnoKeyOriginName]
	if !ok {
		return nil, nil
	}
	t, err := m.GetOriginTimestamp()
	return &ResourceOriginInfo{
		Name:      v,
		Path:      m.GetOriginPath(),
		Hash:      m.GetOriginHash(),
		Timestamp: t,
	}, err
}

func (m *grafanaMetaAccessor) GetOriginName() string {
	return m.get(AnnoKeyOriginName)
}

func (m *grafanaMetaAccessor) GetOriginPath() string {
	return m.get(AnnoKeyOriginPath)
}

func (m *grafanaMetaAccessor) GetOriginHash() string {
	return m.get(AnnoKeyOriginHash)
}

func (m *grafanaMetaAccessor) GetOriginTimestamp() (*time.Time, error) {
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

// GetAnnotations implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetAnnotations() map[string]string {
	return m.obj.GetAnnotations()
}

// GetCreationTimestamp implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetCreationTimestamp() metav1.Time {
	return m.obj.GetCreationTimestamp()
}

// GetDeletionGracePeriodSeconds implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetDeletionGracePeriodSeconds() *int64 {
	return m.obj.GetDeletionGracePeriodSeconds()
}

// GetDeletionTimestamp implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetDeletionTimestamp() *metav1.Time {
	return m.obj.GetDeletionTimestamp()
}

// GetFinalizers implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetFinalizers() []string {
	return m.obj.GetFinalizers()
}

// GetGenerateName implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetGenerateName() string {
	return m.obj.GetGenerateName()
}

// GetGeneration implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetGeneration() int64 {
	return m.obj.GetGeneration()
}

// GetLabels implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetLabels() map[string]string {
	return m.obj.GetLabels()
}

// GetManagedFields implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetManagedFields() []metav1.ManagedFieldsEntry {
	return m.obj.GetManagedFields()
}

// GetName implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetName() string {
	return m.obj.GetName()
}

// GetNamespace implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetNamespace() string {
	return m.obj.GetNamespace()
}

// GetOwnerReferences implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetOwnerReferences() []metav1.OwnerReference {
	return m.obj.GetOwnerReferences()
}

// GetResourceVersion implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetResourceVersion() string {
	return m.obj.GetResourceVersion()
}

// GetSelfLink implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetSelfLink() string {
	return m.obj.GetSelfLink()
}

// GetUID implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetUID() types.UID {
	return m.obj.GetUID()
}

// SetAnnotations implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetAnnotations(annotations map[string]string) {
	m.obj.SetAnnotations(annotations)
}

// SetCreationTimestamp implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetCreationTimestamp(timestamp metav1.Time) {
	m.obj.SetCreationTimestamp(timestamp)
}

// SetDeletionGracePeriodSeconds implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetDeletionGracePeriodSeconds(v *int64) {
	m.obj.SetDeletionGracePeriodSeconds(v)
}

// SetDeletionTimestamp implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetDeletionTimestamp(timestamp *metav1.Time) {
	m.obj.SetDeletionTimestamp(timestamp)
}

// SetFinalizers implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetFinalizers(finalizers []string) {
	m.obj.SetFinalizers(finalizers)
}

// SetGenerateName implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetGenerateName(name string) {
	m.obj.SetGenerateName(name)
}

// SetGeneration implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetGeneration(generation int64) {
	m.obj.SetGeneration(generation)
}

// SetLabels implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetLabels(labels map[string]string) {
	m.obj.SetLabels(labels)
}

// SetManagedFields implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetManagedFields(managedFields []metav1.ManagedFieldsEntry) {
	m.obj.SetManagedFields(managedFields)
}

// SetName implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetName(name string) {
	m.obj.SetName(name)
}

// SetNamespace implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetNamespace(namespace string) {
	m.obj.SetNamespace(namespace)
}

// SetOwnerReferences implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetOwnerReferences(v []metav1.OwnerReference) {
	m.obj.SetOwnerReferences(v)
}

// SetResourceVersion implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetResourceVersion(version string) {
	m.obj.SetResourceVersion(version)
}

// SetSelfLink implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetSelfLink(selfLink string) {
	m.obj.SetSelfLink(selfLink)
}

// SetUID implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetUID(uid types.UID) {
	m.obj.SetUID(uid)
}

func (m *grafanaMetaAccessor) GetGroupVersionKind() schema.GroupVersionKind {
	obj, ok := m.raw.(runtime.Object)
	if ok {
		return obj.GetObjectKind().GroupVersionKind()
	}

	gvk := schema.GroupVersionKind{}
	apiVersion := ""

	typ, ok := m.raw.(metav1.Type)
	if ok {
		apiVersion = typ.GetAPIVersion()
		gvk.Kind = typ.GetKind()
	} else {
		val := m.r.FieldByName("APIVersion")
		if val.IsValid() && val.Kind() == reflect.String {
			apiVersion = val.String()
		}
		val = m.r.FieldByName("Kind")
		if val.IsValid() && val.Kind() == reflect.String {
			gvk.Kind = val.String()
		}
	}
	if apiVersion != "" {
		gv, err := schema.ParseGroupVersion(apiVersion)
		if err == nil {
			gvk.Group = gv.Group
			gvk.Version = gv.Version
		}
	}
	return gvk
}

func (m *grafanaMetaAccessor) GetSpec() (spec any, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("error reading spec")
		}
	}()

	f := m.r.FieldByName("Spec")
	if f.IsValid() {
		spec = f.Interface()
		return
	}

	// Unstructured
	u, ok := m.raw.(*unstructured.Unstructured)
	if ok {
		spec, ok = u.Object["spec"]
		if ok {
			return // no error
		}
	}
	err = fmt.Errorf("unable to read spec")
	return
}

func (m *grafanaMetaAccessor) SetSpec(s any) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("error setting spec")
		}
	}()

	f := m.r.FieldByName("Spec")
	if f.IsValid() {
		f.Set(reflect.ValueOf(s))
		return
	}

	// Unstructured
	u, ok := m.raw.(*unstructured.Unstructured)
	if ok {
		u.Object["spec"] = s
	} else {
		err = fmt.Errorf("unable to set spec")
	}
	return
}

func (m *grafanaMetaAccessor) GetStatus() (status any, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("error reading status")
		}
	}()

	f := m.r.FieldByName("Status")
	if f.IsValid() {
		status = f.Interface()
		return
	}

	// Unstructured
	u, ok := m.raw.(*unstructured.Unstructured)
	if ok {
		status, ok = u.Object["status"]
		if ok {
			return // no error
		}
	}
	err = fmt.Errorf("unable to read status")
	return
}

func (m *grafanaMetaAccessor) SetStatus(s any) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("error setting status")
		}
	}()

	f := m.r.FieldByName("Status")
	if f.IsValid() {
		f.Set(reflect.ValueOf(s))
		return
	}

	// Unstructured
	u, ok := m.raw.(*unstructured.Unstructured)
	if ok {
		u.Object["status"] = s
	} else {
		err = fmt.Errorf("unable to read status")
	}
	return
}

func (m *grafanaMetaAccessor) GetFullPath() string {
	return m.get(AnnoKeyFullPath)
}

func (m *grafanaMetaAccessor) SetFullPath(path string) {
	m.SetAnnotation(AnnoKeyFullPath, path)
}

func (m *grafanaMetaAccessor) GetFullPathUIDs() string {
	return m.get(AnnoKeyFullPathUIDs)
}

func (m *grafanaMetaAccessor) SetFullPathUIDs(path string) {
	m.SetAnnotation(AnnoKeyFullPathUIDs, path)
}

func (m *grafanaMetaAccessor) FindTitle(defaultTitle string) string {
	// look for Spec.Title or Spec.Name
	spec := m.r.FieldByName("Spec")
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

	title := m.r.FieldByName("Title")
	if title.IsValid() && title.Kind() == reflect.String {
		return title.String()
	}
	return defaultTitle
}

type BlobInfo struct {
	UID      string `json:"uid"`
	Size     int64  `json:"size,omitempty"`
	Hash     string `json:"hash,omitempty"`
	MimeType string `json:"mime,omitempty"`
	Charset  string `json:"charset,omitempty"` // content type = mime+charset
}

// Content type is mime + charset
func (b *BlobInfo) SetContentType(v string) {
	var params map[string]string
	var err error

	b.Charset = ""
	b.MimeType, params, err = mime.ParseMediaType(v)
	if err != nil {
		return
	}
	b.Charset = params["charset"]
}

// Content type is mime + charset
func (b *BlobInfo) ContentType() string {
	sb := bytes.NewBufferString(b.MimeType)
	if b.Charset != "" {
		sb.WriteString("; charset=")
		sb.WriteString(b.Charset)
	}
	return sb.String()
}

func (b *BlobInfo) String() string {
	sb := bytes.NewBufferString(b.UID)
	if b.Size > 0 {
		sb.WriteString(fmt.Sprintf("; size=%d", b.Size))
	}
	if b.Hash != "" {
		sb.WriteString("; hash=")
		sb.WriteString(b.Hash)
	}
	if b.MimeType != "" {
		sb.WriteString("; mime=")
		sb.WriteString(b.MimeType)
	}
	if b.Charset != "" {
		sb.WriteString("; charset=")
		sb.WriteString(b.Charset)
	}
	return sb.String()
}

func ParseBlobInfo(v string) *BlobInfo {
	if v == "" {
		return nil
	}
	info := &BlobInfo{}
	for i, part := range strings.Split(v, ";") {
		if i == 0 {
			info.UID = part
			continue
		}
		kv := strings.Split(strings.TrimSpace(part), "=")
		if len(kv) == 2 {
			val := kv[1]
			switch kv[0] {
			case "size":
				info.Size, _ = strconv.ParseInt(val, 10, 64)
			case "hash":
				info.Hash = val
			case "mime":
				info.MimeType = val
			case "charset":
				info.Charset = val
			}
		}
	}
	return info
}
