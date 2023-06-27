package kinds

import (
	"strings"
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
	_ interface{}
}

// GrafanaResourceMetadata is standard k8s object metadata with helper functions
type GrafanaResourceMetadata v1.ObjectMeta

// GrafanaResource is a generic kubernetes resource with a helper for the common grafana metadata
// This is a temporary solution until this object (or similar) can be moved to the app-sdk or kindsys
type GrafanaResource[Spec interface{}, Status interface{}] struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`

	Metadata GrafanaResourceMetadata `json:"metadata"`
	Spec     *Spec                   `json:"spec,omitempty"`
	Status   *Status                 `json:"status,omitempty"`

	// Avoid extending
	_ interface{} `json:"-"`
}

// NOTE: The below annotation keys must confirm to K8s requirements, which are:
//
// a qualified name must consist of alphanumeric characters, '-', '_' or '.', and must start and end with an
// alphanumeric character (e.g. 'MyName',  or 'my.name',  or '123-abc', regex used for validation
// is '([A-Za-z0-9][-A-Za-z0-9_.]*)?[A-Za-z0-9]') with an optional DNS subdomain prefix and '/' (e.g. 'example.com/MyName')

// Annotation keys
const annoKeyCreatedBy = "grafana.com/createdBy"
const annoKeyUpdatedTimestamp = "grafana.com/updatedTimestamp"
const annoKeyUpdatedBy = "grafana.com/updatedBy"
const annoKeyTitle = "grafana.com/title"
const annoKeyDescription = "grafana.com/description"
const annoKeyTags = "grafana.com/tags"

// The commit message -- note! it will be removed on save
const AnnotationKeyCommitMessage = "grafana.com/commitMessage"

// The folder identifier
const annoKeyFolder = "grafana.com/folder"
const annoKeySlug = "grafana.com/slug"

// Identify where values came from
const annoKeyOriginName = "grafana.com/origin.name"
const annoKeyOriginPath = "grafana.com/origin.path"
const annoKeyOriginKey = "grafana.com/origin.key"
const annoKeyOriginTime = "grafana.com/origin.time"

func (m *GrafanaResourceMetadata) set(key string, val string) {
	if val == "" {
		delete(m.Annotations, key)
	} else {
		if m.Annotations == nil {
			m.Annotations = make(map[string]string)
		}
		m.Annotations[key] = val
	}
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

func (m *GrafanaResourceMetadata) SetUpdatedTimestamp(v *time.Time) {
	if v == nil {
		delete(m.Annotations, annoKeyUpdatedTimestamp)
	} else {
		m.Annotations[annoKeyUpdatedTimestamp] = v.Format(time.RFC3339)
	}
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

func (m *GrafanaResourceMetadata) GetTitle() string {
	return m.Annotations[annoKeyTitle]
}

func (m *GrafanaResourceMetadata) SetTitle(v string) {
	m.set(annoKeyTitle, v)
}

func (m *GrafanaResourceMetadata) GetDescription() string {
	return m.Annotations[annoKeyDescription]
}

func (m *GrafanaResourceMetadata) SetDescription(v string) {
	m.set(annoKeyDescription, v)
}

func (m *GrafanaResourceMetadata) GetTags() []string {
	v, ok := m.Annotations[annoKeyTags]
	if ok {
		tags := strings.Split(v, ",")
		for i := range tags {
			tags[i] = strings.TrimSpace(tags[i])
		}
		return tags
	}
	return []string{}
}

// SetTags will set the tags annotation.  NOTE: any commas in the tags will get replaced with a dash
func (m *GrafanaResourceMetadata) SetTags(tags []string) {
	str := ""
	if len(tags) > 0 {
		for i := range tags {
			tags[i] = strings.ReplaceAll(strings.TrimSpace(tags[i]), ",", "-")
		}
		str = strings.Join(tags, ",")
	}
	m.set(annoKeyTags, str)
}

func (m *GrafanaResourceMetadata) GetCommitMessage() string {
	return m.Annotations[AnnotationKeyCommitMessage]
}

// SetCommitMessage will add a message used in the resource history.
// NOTE: this will be removed from the resource when persisted and added to the history subresource
func (m *GrafanaResourceMetadata) SetCommitMessage(msg string) {
	m.set(AnnotationKeyCommitMessage, msg)
}

func (m *GrafanaResourceMetadata) SetOriginInfo(info *ResourceOriginInfo) {
	delete(m.Annotations, annoKeyOriginName)
	delete(m.Annotations, annoKeyOriginPath)
	delete(m.Annotations, annoKeyOriginKey)
	delete(m.Annotations, annoKeyOriginTime)
	if info != nil && info.Name != "" {
		m.Annotations[annoKeyOriginName] = info.Name
		if info.Path != "" {
			m.Annotations[annoKeyOriginPath] = info.Path
		}
		if info.Key != "" {
			m.Annotations[annoKeyOriginKey] = info.Key
		}
		if info.Timestamp != nil {
			m.Annotations[annoKeyOriginTime] = info.Timestamp.Format(time.RFC3339)
		}
	}
}

// GetOriginInfo returns the origin info stored in k8s metadata annotations
func (m *GrafanaResourceMetadata) GetOriginInfo() *ResourceOriginInfo {
	v, ok := m.Annotations[annoKeyOriginName]
	if !ok || v == "" {
		return nil
	}
	info := &ResourceOriginInfo{
		Name: v,
		Path: m.Annotations[annoKeyOriginPath],
		Key:  m.Annotations[annoKeyOriginKey],
	}
	v, ok = m.Annotations[annoKeyOriginTime]
	if ok {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			info.Timestamp = &t
		}
	}
	return info
}
