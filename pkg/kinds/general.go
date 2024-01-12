package kinds

import (
	"fmt"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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

// GrafanaResourceMetadata is standard k8s object metadata with helper functions
type GrafanaResourceMetadata v1.ObjectMeta

// GrafanaResource is a generic kubernetes resource with a helper for the common grafana metadata
// This is a temporary solution until this object (or similar) can be moved to the app-sdk or kindsys
type GrafanaResource[Spec any, Status any] struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`

	Metadata GrafanaResourceMetadata `json:"metadata"`
	Spec     *Spec                   `json:"spec,omitempty"`
	Status   *Status                 `json:"status,omitempty"`

	// Avoid extending
	_ any `json:"-"`
}

// Annotation keys
const annoKeyCreatedBy = "grafana.app/createdBy"
const annoKeyUpdatedTimestamp = "grafana.app/updatedTimestamp"
const annoKeyUpdatedBy = "grafana.app/updatedBy"

// The folder identifier
const annoKeyFolder = "grafana.app/folder"
const annoKeySlug = "grafana.app/slug"
const annoKeyTitle = "grafana.app/title"

// Identify where values came from
const annoKeyOriginName = "grafana.app/originName"
const annoKeyOriginPath = "grafana.app/originPath"
const annoKeyOriginKey = "grafana.app/originKey"
const annoKeyOriginTimestamp = "grafana.app/originTimestamp"

func (m *GrafanaResourceMetadata) set(key string, val string) {
	if val == "" {
		if m.Annotations != nil {
			delete(m.Annotations, key)
		}
		return
	}
	if m.Annotations == nil {
		m.Annotations = make(map[string]string)
	}
	m.Annotations[key] = val
}

func (m *GrafanaResourceMetadata) get(key string) string {
	if m.Annotations == nil {
		return ""
	}
	return m.Annotations[key]
}

func (m *GrafanaResourceMetadata) GetUpdatedTimestamp() (*time.Time, error) {
	v, ok := m.Annotations[annoKeyUpdatedTimestamp]
	if !ok || v == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil, fmt.Errorf("invalid updated timestamp: %s", err.Error())
	}
	return &t, nil
}

func (m *GrafanaResourceMetadata) SetUpdatedTimestampMillis(v int64) {
	if v > 0 {
		t := time.UnixMilli(v)
		m.SetUpdatedTimestamp(&t)
	} else {
		m.SetUpdatedTimestamp(nil)
	}
}

func (m *GrafanaResourceMetadata) SetUpdatedTimestamp(v *time.Time) {
	txt := ""
	if v != nil {
		txt = v.UTC().Format(time.RFC3339)
	}
	m.set(annoKeyUpdatedTimestamp, txt)
}

func (m *GrafanaResourceMetadata) GetCreatedBy() string {
	return m.Annotations[annoKeyCreatedBy]
}

func (m *GrafanaResourceMetadata) SetCreatedBy(user string) {
	m.set(annoKeyCreatedBy, user)
}

func (m *GrafanaResourceMetadata) GetUpdatedBy() string {
	return m.Annotations[annoKeyUpdatedBy]
}

func (m *GrafanaResourceMetadata) SetUpdatedBy(user string) {
	m.set(annoKeyUpdatedBy, user)
}

func (m *GrafanaResourceMetadata) GetFolder() string {
	return m.Annotations[annoKeyFolder]
}

func (m *GrafanaResourceMetadata) SetFolder(uid string) {
	m.set(annoKeyFolder, uid)
}

func (m *GrafanaResourceMetadata) GetSlug() string {
	return m.get(annoKeySlug)
}

func (m *GrafanaResourceMetadata) SetSlug(v string) {
	m.set(annoKeySlug, v)
}

func (m *GrafanaResourceMetadata) GetTitle() string {
	return m.get(annoKeyTitle)
}

func (m *GrafanaResourceMetadata) SetTitle(v string) {
	m.set(annoKeyTitle, v)
}

func (m *GrafanaResourceMetadata) SetOriginInfo(info *ResourceOriginInfo) {
	delete(m.Annotations, annoKeyOriginName)
	delete(m.Annotations, annoKeyOriginPath)
	delete(m.Annotations, annoKeyOriginKey)
	delete(m.Annotations, annoKeyOriginTimestamp)
	if info != nil && info.Name != "" {
		m.set(annoKeyOriginName, info.Name)
		m.set(annoKeyOriginKey, info.Key)
		m.set(annoKeyOriginPath, info.Path)
		if info.Timestamp != nil {
			m.Annotations[annoKeyOriginTimestamp] = info.Timestamp.Format(time.RFC3339)
		}
	}
}

// GetOriginInfo returns the origin info stored in k8s metadata annotations
func (m *GrafanaResourceMetadata) GetOriginInfo() (*ResourceOriginInfo, error) {
	v, ok := m.Annotations[annoKeyOriginName]
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

func (m *GrafanaResourceMetadata) GetOriginName() string {
	return m.Annotations[annoKeyOriginName]
}

func (m *GrafanaResourceMetadata) GetOriginPath() string {
	return m.Annotations[annoKeyOriginPath]
}

func (m *GrafanaResourceMetadata) GetOriginKey() string {
	return m.Annotations[annoKeyOriginKey]
}

func (m *GrafanaResourceMetadata) GetOriginTimestamp() (*time.Time, error) {
	v, ok := m.Annotations[annoKeyOriginTimestamp]
	if !ok || v == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil, fmt.Errorf("invalid origin timestamp: %s", err.Error())
	}
	return &t, nil
}

// Accessor functions for k8s objects
type GrafanaResourceMetaAccessor interface {
	GetUpdatedTimestamp() (*time.Time, error)
	SetUpdatedTimestamp(v *time.Time)
	GetCreatedBy() string
	SetCreatedBy(user string)
	GetUpdatedBy() string
	SetUpdatedBy(user string)
	GetFolder() string
	SetFolder(uid string)
	GetSlug() string
	SetSlug(v string)
	GetTitle() string
	SetTitle(v string)
	GetOriginInfo() (*ResourceOriginInfo, error)
	SetOriginInfo(info *ResourceOriginInfo)
	GetOriginName() string
	GetOriginPath() string
	GetOriginKey() string
	GetOriginTimestamp() (*time.Time, error)
}

var _ GrafanaResourceMetaAccessor = (*grafanaResourceMetaAccessor)(nil)
var _ GrafanaResourceMetaAccessor = (*GrafanaResourceMetadata)(nil)

type grafanaResourceMetaAccessor struct {
	obj v1.Object
}

func MetaAccessor(obj v1.Object) GrafanaResourceMetaAccessor {
	return &grafanaResourceMetaAccessor{obj}
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
	v, ok := m.obj.GetAnnotations()[annoKeyUpdatedTimestamp]
	if !ok || v == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil, fmt.Errorf("invalid updated timestamp: %s", err.Error())
	}
	return &t, nil
}

func (m *grafanaResourceMetaAccessor) SetUpdatedTimestampMillis(v int64) {
	if v > 0 {
		t := time.UnixMilli(v)
		m.SetUpdatedTimestamp(&t)
	} else {
		m.SetUpdatedTimestamp(nil)
	}
}

func (m *grafanaResourceMetaAccessor) SetUpdatedTimestamp(v *time.Time) {
	txt := ""
	if v != nil {
		txt = v.UTC().Format(time.RFC3339)
	}
	m.set(annoKeyUpdatedTimestamp, txt)
}

func (m *grafanaResourceMetaAccessor) GetCreatedBy() string {
	return m.get(annoKeyCreatedBy)
}

func (m *grafanaResourceMetaAccessor) SetCreatedBy(user string) {
	m.set(annoKeyCreatedBy, user)
}

func (m *grafanaResourceMetaAccessor) GetUpdatedBy() string {
	return m.get(annoKeyUpdatedBy)
}

func (m *grafanaResourceMetaAccessor) SetUpdatedBy(user string) {
	m.set(annoKeyUpdatedBy, user)
}

func (m *grafanaResourceMetaAccessor) GetFolder() string {
	return m.get(annoKeyFolder)
}

func (m *grafanaResourceMetaAccessor) SetFolder(uid string) {
	m.set(annoKeyFolder, uid)
}

func (m *grafanaResourceMetaAccessor) GetSlug() string {
	return m.get(annoKeySlug)
}

func (m *grafanaResourceMetaAccessor) SetSlug(v string) {
	m.set(annoKeySlug, v)
}
func (m *grafanaResourceMetaAccessor) GetTitle() string {
	return m.get(annoKeyTitle)
}

func (m *grafanaResourceMetaAccessor) SetTitle(v string) {
	m.set(annoKeyTitle, v)
}
func (m *grafanaResourceMetaAccessor) SetOriginInfo(info *ResourceOriginInfo) {
	anno := m.obj.GetAnnotations()
	if anno == nil {
		if info == nil {
			return
		}
		anno = make(map[string]string, 0)
		m.obj.SetAnnotations(anno)
	}

	delete(anno, annoKeyOriginName)
	delete(anno, annoKeyOriginPath)
	delete(anno, annoKeyOriginKey)
	delete(anno, annoKeyOriginTimestamp)
	if info != nil && info.Name != "" {
		anno[annoKeyOriginName] = info.Name
		if info.Path != "" {
			anno[annoKeyOriginPath] = info.Path
		}
		if info.Key != "" {
			anno[annoKeyOriginKey] = info.Key
		}
		if info.Timestamp != nil {
			anno[annoKeyOriginTimestamp] = info.Timestamp.Format(time.RFC3339)
		}
	}
	m.obj.SetAnnotations(anno)
}

func (m *grafanaResourceMetaAccessor) GetOriginInfo() (*ResourceOriginInfo, error) {
	v, ok := m.obj.GetAnnotations()[annoKeyOriginName]
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
	return m.get(annoKeyOriginName)
}

func (m *grafanaResourceMetaAccessor) GetOriginPath() string {
	return m.get(annoKeyOriginPath)
}

func (m *grafanaResourceMetaAccessor) GetOriginKey() string {
	return m.get(annoKeyOriginKey)
}

func (m *grafanaResourceMetaAccessor) GetOriginTimestamp() (*time.Time, error) {
	v, ok := m.obj.GetAnnotations()[annoKeyOriginTimestamp]
	if !ok || v == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil, fmt.Errorf("invalid origin timestamp: %s", err.Error())
	}
	return &t, nil
}
