package kinds

import (
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

func (m *GrafanaResourceMetadata) GetUpdatedTimestamp() *time.Time {
	v, ok := m.Annotations[annoKeyUpdatedTimestamp]
	if ok {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return &t
		}
	}
	return nil
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
	return m.Annotations[annoKeySlug]
}

func (m *GrafanaResourceMetadata) SetSlug(v string) {
	m.set(annoKeySlug, v)
}

func (m *GrafanaResourceMetadata) SetOriginInfo(info *ResourceOriginInfo) {
	delete(m.Annotations, annoKeyOriginName)
	delete(m.Annotations, annoKeyOriginPath)
	delete(m.Annotations, annoKeyOriginKey)
	delete(m.Annotations, annoKeyOriginTimestamp)
	if info != nil || info.Name != "" {
		m.set(annoKeyOriginName, info.Name)
		m.set(annoKeyOriginKey, info.Key)
		m.set(annoKeyOriginPath, info.Path)
		if info.Timestamp != nil {
			m.Annotations[annoKeyOriginTimestamp] = info.Timestamp.Format(time.RFC3339)
		}
	}
}

// GetOriginInfo returns the origin info stored in k8s metadata annotations
func (m *GrafanaResourceMetadata) GetOriginInfo() *ResourceOriginInfo {
	v, ok := m.Annotations[annoKeyOriginName]
	if !ok {
		return nil
	}
	info := &ResourceOriginInfo{
		Name: v,
		Path: m.Annotations[annoKeyOriginPath],
		Key:  m.Annotations[annoKeyOriginKey],
	}
	v, ok = m.Annotations[annoKeyOriginTimestamp]
	if ok {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			info.Timestamp = &t
		}
	}
	return info
}
