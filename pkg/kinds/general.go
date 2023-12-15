package kinds

import (
	"fmt"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis"
)

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
	v, ok := m.Annotations[apis.AnnoKeyUpdatedTimestamp]
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
	m.set(apis.AnnoKeyUpdatedTimestamp, txt)
}

func (m *GrafanaResourceMetadata) GetCreatedBy() string {
	return m.Annotations[apis.AnnoKeyCreatedBy]
}

func (m *GrafanaResourceMetadata) SetCreatedBy(user string) {
	m.set(apis.AnnoKeyCreatedBy, user)
}

func (m *GrafanaResourceMetadata) GetUpdatedBy() string {
	return m.Annotations[apis.AnnoKeyUpdatedBy]
}

func (m *GrafanaResourceMetadata) SetUpdatedBy(user string) {
	m.set(apis.AnnoKeyUpdatedBy, user)
}

func (m *GrafanaResourceMetadata) GetFolder() string {
	return m.Annotations[apis.AnnoKeyFolder]
}

func (m *GrafanaResourceMetadata) SetFolder(uid string) {
	m.set(apis.AnnoKeyFolder, uid)
}

func (m *GrafanaResourceMetadata) GetSlug() string {
	return m.get(apis.AnnoKeySlug)
}

func (m *GrafanaResourceMetadata) SetSlug(v string) {
	m.set(apis.AnnoKeySlug, v)
}

func (m *GrafanaResourceMetadata) GetTitle() string {
	return m.get(apis.AnnoKeyTitle)
}

func (m *GrafanaResourceMetadata) SetTitle(v string) {
	m.set(apis.AnnoKeyTitle, v)
}

func (m *GrafanaResourceMetadata) SetOriginInfo(info *apis.ResourceOriginInfo) {
	delete(m.Annotations, apis.AnnoKeyOriginName)
	delete(m.Annotations, apis.AnnoKeyOriginPath)
	delete(m.Annotations, apis.AnnoKeyOriginKey)
	delete(m.Annotations, apis.AnnoKeyOriginTimestamp)
	if info != nil && info.Name != "" {
		m.set(apis.AnnoKeyOriginName, info.Name)
		m.set(apis.AnnoKeyOriginKey, info.Key)
		m.set(apis.AnnoKeyOriginPath, info.Path)
		if info.Timestamp != nil {
			m.Annotations[apis.AnnoKeyOriginTimestamp] = info.Timestamp.Format(time.RFC3339)
		}
	}
}

// GetOriginInfo returns the origin info stored in k8s metadata annotations
func (m *GrafanaResourceMetadata) GetOriginInfo() (*apis.ResourceOriginInfo, error) {
	v, ok := m.Annotations[apis.AnnoKeyOriginName]
	if !ok {
		return nil, nil
	}
	t, err := m.GetOriginTimestamp()
	return &apis.ResourceOriginInfo{
		Name:      v,
		Path:      m.GetOriginPath(),
		Key:       m.GetOriginKey(),
		Timestamp: t,
	}, err
}

func (m *GrafanaResourceMetadata) GetOriginName() string {
	return m.Annotations[apis.AnnoKeyOriginName]
}

func (m *GrafanaResourceMetadata) GetOriginPath() string {
	return m.Annotations[apis.AnnoKeyOriginPath]
}

func (m *GrafanaResourceMetadata) GetOriginKey() string {
	return m.Annotations[apis.AnnoKeyOriginKey]
}

func (m *GrafanaResourceMetadata) GetOriginTimestamp() (*time.Time, error) {
	v, ok := m.Annotations[apis.AnnoKeyOriginTimestamp]
	if !ok || v == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil, fmt.Errorf("invalid origin timestamp: %s", err.Error())
	}
	return &t, nil
}
