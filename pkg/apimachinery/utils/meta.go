package utils

import (
	"fmt"
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

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// LabelKeyGetHistory is used to select object history for an given resource
const LabelKeyGetHistory = "grafana.app/get-history"

// LabelKeyGetTrash is used to list objects that have been (soft) deleted
const LabelKeyGetTrash = "grafana.app/get-trash"

// AnnoKeyKubectlLastAppliedConfig is the annotation kubectl writes with the entire previous config
const AnnoKeyKubectlLastAppliedConfig = "kubectl.kubernetes.io/last-applied-configuration"

// AnnoKeyGrantPermissions allows users to explicitly grant themself permissions when creating
// resoures in the "root" folder.  This annotation is not saved and invalud for update.
const AnnoKeyGrantPermissions = "grafana.app/grant-permissions"

// AnnoGrantPermissionsDefault is the value that should be sent with AnnoKeyGrantPermissions
const AnnoGrantPermissionsDefault = "default"

// DeletedGeneration is set on Resources that have been (soft) deleted
const DeletedGeneration = int64(-999)

// Annotation keys

const AnnoKeyCreatedBy = "grafana.app/createdBy"
const AnnoKeyUpdatedTimestamp = "grafana.app/updatedTimestamp"
const AnnoKeyUpdatedBy = "grafana.app/updatedBy"
const AnnoKeyFolder = "grafana.app/folder"
const AnnoKeyBlob = "grafana.app/blob"
const AnnoKeyMessage = "grafana.app/message"

// Identify where values came from

const oldAnnoKeyRepoName = "grafana.app/repoName"
const oldAnnoKeyRepoPath = "grafana.app/repoPath"
const oldAnnoKeyRepoHash = "grafana.app/repoHash"
const oldAnnoKeyRepoTimestamp = "grafana.app/repoTimestamp"

// Annotations used to store manager properties

const AnnoKeyManagerKind = "grafana.app/managedBy"
const AnnoKeyManagerIdentity = "grafana.app/managerId"
const AnnoKeyManagerAllowsEdits = "grafana.app/managerAllowsEdits"
const AnnoKeyManagerSuspended = "grafana.app/managerSuspended"

// Annotations used to store source properties

const AnnoKeySourcePath = "grafana.app/sourcePath"
const AnnoKeySourceChecksum = "grafana.app/sourceChecksum"
const AnnoKeySourceTimestamp = "grafana.app/sourceTimestamp"

// Only used in modes 0-2 (legacy db) for returning the folder fullpath

const LabelGetFullpath = "grafana.app/fullpath"
const AnnoKeyFullpath = "grafana.app/fullpath"
const AnnoKeyFullpathUIDs = "grafana.app/fullpathUIDs"

// LabelKeyDeprecatedInternalID gives the deprecated internal ID of a resource
// Deprecated: will be removed in grafana 13
const LabelKeyDeprecatedInternalID = "grafana.app/deprecatedInternalID"

// Accessor functions for k8s objects
//
//go:generate mockery --name GrafanaMetaAccessor --structname MockGrafanaMetaAccessor --inpackage --filename meta_mock.go --with-expecter
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
	GetAnnotation(key string) string

	SetBlob(v *BlobInfo)
	GetBlob() *BlobInfo

	// Deprecated: This will be removed in Grafana 13
	GetDeprecatedInternalID() int64

	// Deprecated: This will be removed in Grafana 13
	SetDeprecatedInternalID(id int64)

	GetFullpath() string
	SetFullpath(path string)
	GetFullpathUIDs() string
	SetFullpathUIDs(uids string)

	GetSpec() (any, error)
	SetSpec(any) error

	GetStatus() (any, error)

	// Used by the generic strategy to keep the status value unchanged on an update
	// NOTE the type must match the existing value, or an error will be thrown
	SetStatus(any) error

	// Find a title in the object
	// This will reflect the object and try to get:
	//  * spec.title
	//  * spec.name
	//  * title
	// and return an empty string if nothing was found
	FindTitle(defaultTitle string) string

	// GetManagerProperties returns the identity of the tool,
	// which is responsible for managing the resource.
	//
	// If the identity is not known, the second return value will be false.
	GetManagerProperties() (ManagerProperties, bool)

	// SetManagerProperties sets the identity of the tool,
	// which is responsible for managing the resource.
	SetManagerProperties(ManagerProperties)

	// GetSourceProperties returns the source properties of the resource.
	GetSourceProperties() (SourceProperties, bool)

	// SetSourceProperties sets the source properties of the resource.
	SetSourceProperties(SourceProperties)

	// GetSecureValues reads the "secure" property on a resource
	GetSecureValues() (common.InlineSecureValues, error)

	// SetSourceProperties sets the source properties of the resource.
	// For write commands, this may include inline secrets; read will only have references
	SetSecureValues(common.InlineSecureValues) error
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
	if raw == nil {
		return nil, fmt.Errorf("unable to read metadata from nil object")
	}

	obj, err := meta.Accessor(raw)
	if err != nil {
		return nil, fmt.Errorf("unable to read metadata from: %T, %s", raw, err)
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

func (m *grafanaMetaAccessor) GetAnnotation(key string) string {
	anno := m.obj.GetAnnotations()
	if anno == nil {
		return ""
	}
	return anno[key]
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
	return m.GetAnnotation(AnnoKeyCreatedBy)
}

func (m *grafanaMetaAccessor) SetCreatedBy(user string) {
	m.SetAnnotation(AnnoKeyCreatedBy, user)
}

func (m *grafanaMetaAccessor) GetUpdatedBy() string {
	return m.GetAnnotation(AnnoKeyUpdatedBy)
}

func (m *grafanaMetaAccessor) SetUpdatedBy(user string) {
	m.SetAnnotation(AnnoKeyUpdatedBy, user)
}

func (m *grafanaMetaAccessor) GetBlob() *BlobInfo {
	return ParseBlobInfo(m.GetAnnotation(AnnoKeyBlob))
}

func (m *grafanaMetaAccessor) SetBlob(info *BlobInfo) {
	if info == nil {
		m.SetAnnotation(AnnoKeyBlob, "") // delete
	} else {
		m.SetAnnotation(AnnoKeyBlob, info.String())
	}
}

func (m *grafanaMetaAccessor) GetFolder() string {
	return m.GetAnnotation(AnnoKeyFolder)
}

func (m *grafanaMetaAccessor) SetFolder(uid string) {
	m.SetAnnotation(AnnoKeyFolder, uid)
}

func (m *grafanaMetaAccessor) GetMessage() string {
	return m.GetAnnotation(AnnoKeyMessage)
}

func (m *grafanaMetaAccessor) SetMessage(uid string) {
	m.SetAnnotation(AnnoKeyMessage, uid)
}

// This will be removed in Grafana 13. Do not add any new usage of it.
func (m *grafanaMetaAccessor) GetDeprecatedInternalID() int64 {
	labels := m.obj.GetLabels()
	if labels == nil {
		return 0
	}

	if internalID, ok := labels[LabelKeyDeprecatedInternalID]; ok {
		id, err := strconv.ParseInt(internalID, 10, 64)
		if err == nil {
			return id
		}
	}

	return 0
}

// This will be removed in Grafana 13. Do not add any new usage of it.
func (m *grafanaMetaAccessor) SetDeprecatedInternalID(id int64) {
	labels := m.obj.GetLabels()

	// disallow setting it to 0
	if id == 0 {
		if labels != nil {
			delete(labels, LabelKeyDeprecatedInternalID)
			m.obj.SetLabels(labels)
		}
		return
	}

	if labels == nil {
		labels = make(map[string]string)
	}

	labels[LabelKeyDeprecatedInternalID] = strconv.FormatInt(id, 10)
	m.obj.SetLabels(labels)
}

func (m *grafanaMetaAccessor) GetFullpath() string {
	return m.GetAnnotation(AnnoKeyFullpath)
}

func (m *grafanaMetaAccessor) SetFullpath(path string) {
	m.SetAnnotation(AnnoKeyFullpath, path)
}

func (m *grafanaMetaAccessor) GetFullpathUIDs() string {
	return m.GetAnnotation(AnnoKeyFullpathUIDs)
}

func (m *grafanaMetaAccessor) SetFullpathUIDs(uids string) {
	m.SetAnnotation(AnnoKeyFullpathUIDs, uids)
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

		// Unstructured uses Object subtype
		object := spec.FieldByName("Object")
		if object.IsValid() && object.Kind() == reflect.Map {
			key := reflect.ValueOf("title")
			value := object.MapIndex(key)
			if value.IsValid() {
				if value.CanInterface() {
					v := value.Interface()
					t, ok := v.(string)
					if ok {
						return t
					}
				}
			}
		}
	}

	obj, ok := m.obj.(*unstructured.Unstructured)
	if ok {
		title, ok, _ := unstructured.NestedString(obj.Object, "spec", "title")
		if ok && title != "" {
			return title
		}
		title, ok, _ = unstructured.NestedString(obj.Object, "spec", "name")
		if ok && title != "" {
			return title
		}
	}

	title := m.r.FieldByName("Title")
	if title.IsValid() && title.Kind() == reflect.String {
		return title.String()
	}
	return defaultTitle
}

func (m *grafanaMetaAccessor) GetManagerProperties() (ManagerProperties, bool) {
	res := ManagerProperties{
		Identity:    "",
		Kind:        ManagerKindUnknown,
		AllowsEdits: false,
		Suspended:   false,
	}

	annot := m.obj.GetAnnotations()

	id, ok := annot[AnnoKeyManagerIdentity]
	if !ok || id == "" {
		// Temporarily support the repo name annotation
		repo := annot[oldAnnoKeyRepoName]
		if repo != "" {
			return ManagerProperties{
				Kind:     ManagerKindRepo,
				Identity: repo,
			}, true
		}

		// If the identity is not set, we should ignore the other annotations and return the default values.
		//
		// This is to prevent inadvertently marking resources as managed,
		// since that can potentially block updates from other sources.
		return res, false
	}
	res.Identity = id

	if v, ok := annot[AnnoKeyManagerKind]; ok {
		res.Kind = ParseManagerKindString(v)
	}

	if v, ok := annot[AnnoKeyManagerAllowsEdits]; ok {
		res.AllowsEdits = v == "true"
	}

	if v, ok := annot[AnnoKeyManagerSuspended]; ok {
		res.Suspended = v == "true"
	}

	return res, true
}

func (m *grafanaMetaAccessor) SetManagerProperties(v ManagerProperties) {
	annot := m.obj.GetAnnotations()
	if annot == nil {
		annot = make(map[string]string, 4)
	}

	if v.Identity != "" {
		annot[AnnoKeyManagerIdentity] = v.Identity
	} else {
		delete(annot, AnnoKeyManagerIdentity)
	}

	if string(v.Kind) != "" {
		annot[AnnoKeyManagerKind] = string(v.Kind)
	} else {
		delete(annot, AnnoKeyManagerKind)
	}

	if v.AllowsEdits {
		annot[AnnoKeyManagerAllowsEdits] = strconv.FormatBool(v.AllowsEdits)
	} else {
		delete(annot, AnnoKeyManagerAllowsEdits)
	}
	if v.Suspended {
		annot[AnnoKeyManagerSuspended] = strconv.FormatBool(v.Suspended)
	} else {
		delete(annot, AnnoKeyManagerSuspended)
	}

	// Clean up old annotation access
	delete(annot, oldAnnoKeyRepoName)

	m.obj.SetAnnotations(annot)
}

func (m *grafanaMetaAccessor) GetSourceProperties() (SourceProperties, bool) {
	var (
		res   SourceProperties
		found bool
	)

	annot := m.obj.GetAnnotations()
	if annot == nil {
		return res, false
	}

	if path, ok := annot[AnnoKeySourcePath]; ok && path != "" {
		res.Path = path
		found = true
	} else if path, ok := annot[oldAnnoKeyRepoPath]; ok && path != "" {
		res.Path = path
		found = true
	}

	if hash, ok := annot[AnnoKeySourceChecksum]; ok && hash != "" {
		res.Checksum = hash
		found = true
	} else if hash, ok := annot[oldAnnoKeyRepoHash]; ok && hash != "" {
		res.Checksum = hash
		found = true
	}

	t, ok := annot[AnnoKeySourceTimestamp]
	if !ok {
		t, ok = annot[oldAnnoKeyRepoTimestamp]
	}
	if ok && t != "" {
		var err error
		res.TimestampMillis, err = strconv.ParseInt(t, 10, 64)
		if err != nil {
			found = true
		}
	}

	return res, found
}

func (m *grafanaMetaAccessor) SetSourceProperties(v SourceProperties) {
	annot := m.obj.GetAnnotations()
	if annot == nil {
		annot = make(map[string]string, 3)
	}

	if v.Path != "" {
		annot[AnnoKeySourcePath] = v.Path
	} else {
		delete(annot, AnnoKeySourcePath)
	}

	if v.Checksum != "" {
		annot[AnnoKeySourceChecksum] = v.Checksum
	} else {
		delete(annot, AnnoKeySourceChecksum)
	}

	if v.TimestampMillis > 0 {
		annot[AnnoKeySourceTimestamp] = strconv.FormatInt(v.TimestampMillis, 10)
	} else {
		delete(annot, AnnoKeySourceTimestamp)
	}

	m.obj.SetAnnotations(annot)
}

// GetSecureValues implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) GetSecureValues() (vals common.InlineSecureValues, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("error reading secure values")
		}
	}()

	var property any // may be map or struct

	f := m.r.FieldByName("Secure")
	if f.IsValid() {
		property = f.Interface()
	} else {
		// Unstructured
		u, ok := m.raw.(*unstructured.Unstructured)
		if ok {
			property = u.Object["secure"]
		}
	}

	// Not found (and no error)
	if property == nil {
		return nil, nil
	}

	// Try directly casting the property
	vals, ok := property.(common.InlineSecureValues)
	if ok {
		return vals, nil
	}

	// Generic map
	u, ok := property.(map[string]any)
	if ok {
		vals = make(common.InlineSecureValues, len(u))
		for k, v := range u {
			sv, ok := v.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("unsupported nested secure value: %t", v)
			}
			inline := common.InlineSecureValue{}
			inline.Name, _, _ = unstructured.NestedString(sv, "name")
			inline.Remove, _, _ = unstructured.NestedBool(sv, "remove")
			create, _, _ := unstructured.NestedString(sv, "create")
			if create != "" {
				inline.Create = common.NewSecretValue(create)
			}
			vals[k] = inline
		}
		return vals, nil
	}

	if f.Kind() == reflect.Struct {
		num := f.NumField()
		vals = make(common.InlineSecureValues, num)
		for i := range num {
			val := f.Field(i)
			if val.IsValid() && val.CanInterface() {
				property = val.Interface()
				inline, ok := property.(common.InlineSecureValue)
				if !ok {
					return nil, fmt.Errorf("secure property must be InlineSecureValue (found: %T)", property)
				}

				if inline.IsZero() {
					continue // nothing
				}

				vals[getJSONFieldName(f, i)] = inline
				continue
			}
			return nil, fmt.Errorf("value not an interface")
		}
		return vals, nil
	}

	return nil, fmt.Errorf("secure value saved in unsupported type: %T", property)
}

// SetSecureValues implements GrafanaMetaAccessor.
func (m *grafanaMetaAccessor) SetSecureValues(vals common.InlineSecureValues) (err error) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("ERR: %v", r)
			err = fmt.Errorf("error writing secure values")
		}
	}()

	f := m.r.FieldByName("Secure")
	if f.IsValid() && f.CanSet() {
		if f.Kind() == reflect.Struct {
			keys := make(map[string]bool, len(vals))
			for k := range vals {
				keys[k] = true
			}
			for i := 0; i < f.NumField(); i++ {
				val := f.Field(i)
				if val.IsValid() && val.CanInterface() && val.CanSet() {
					k := getJSONFieldName(f, i)
					sv := vals[k]
					val.Set(reflect.ValueOf(sv))
					delete(keys, k)
				} else {
					return fmt.Errorf("invalid secure value: %v", val)
				}
			}
			if len(keys) > 0 {
				return fmt.Errorf("invalid secure value key: %v", keys)
			}
			return
		}

		// It should be a generic map
		f.Set(reflect.ValueOf(vals))
		return
	}

	// Unstructured object
	u, ok := m.raw.(*unstructured.Unstructured)
	if ok {
		u.Object["secure"] = vals
		return
	}

	return fmt.Errorf("unable to set secure values on (%T)", m.raw)
}

func getJSONFieldName(f reflect.Value, idx int) string {
	field := f.Type().Field(idx)
	fname := field.Tag.Get("json")
	if fname == "" {
		return field.Name
	}
	fname, _ = strings.CutSuffix(fname, ",omitempty")
	return fname
}

func ToObjectReference(obj GrafanaMetaAccessor) common.ObjectReference {
	gvk := obj.GetGroupVersionKind()
	return common.ObjectReference{
		APIGroup:   gvk.Group,
		APIVersion: gvk.Version,
		Kind:       gvk.Kind,
		Namespace:  obj.GetNamespace(),
		Name:       obj.GetName(),
		UID:        obj.GetUID(),
	}
}
