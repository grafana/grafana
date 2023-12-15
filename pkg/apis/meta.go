package apis

import (
	"fmt"
	"reflect"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime"
)

// Annotation keys

const AnnoKeyCreatedBy = "grafana.app/createdBy"
const AnnoKeyUpdatedTimestamp = "grafana.app/updatedTimestamp"
const AnnoKeyUpdatedBy = "grafana.app/updatedBy"
const AnnoKeyFolder = "grafana.app/folder"
const AnnoKeySlug = "grafana.app/slug"
const AnnoKeyTitle = "grafana.app/title"

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

type grafanaResourceMetaAccessor struct {
	obj runtime.Object
}

func MetaAccessor(obj runtime.Object) GrafanaResourceMetaAccessor {
	return &grafanaResourceMetaAccessor{obj}
}

func (m *grafanaResourceMetaAccessor) set(key string, val string) {
	acc, err := meta.Accessor(m.obj)
	if err != nil {
		return
	}

	anno := acc.GetAnnotations()
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
	acc.SetAnnotations(anno)
}

func (m *grafanaResourceMetaAccessor) get(key string) string {
	acc, err := meta.Accessor(m.obj)
	if err != nil {
		return ""
	}

	return acc.GetAnnotations()[key]
}

func (m *grafanaResourceMetaAccessor) GetUpdatedTimestamp() (*time.Time, error) {
	acc, err := meta.Accessor(m.obj)
	if err != nil {
		return nil, err
	}

	v, ok := acc.GetAnnotations()[AnnoKeyUpdatedTimestamp]
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
func (m *grafanaResourceMetaAccessor) GetTitle() string {
	// look for Spec.Title or Spec.Name
	r := reflect.ValueOf(m.obj)
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
	}

	// fall back to annotation
	return m.get(AnnoKeyTitle)
}

func (m *grafanaResourceMetaAccessor) SetTitle(v string) {
	// set Spec.Title or Spec.Name if they exist
	r := reflect.ValueOf(m.obj)
	if r.Kind() == reflect.Ptr || r.Kind() == reflect.Interface {
		r = r.Elem()
	}
	if r.Kind() == reflect.Struct {
		spec := r.FieldByName("Spec")
		if spec.Kind() == reflect.Struct {
			title := spec.FieldByName("Title")
			if title.IsValid() && title.Kind() == reflect.String {
				title.SetString(v)
				return
			}
			name := spec.FieldByName("Name")
			if name.IsValid() && name.Kind() == reflect.String {
				name.SetString(v)
				return
			}
		}
	}

	// fall back to annotation
	m.set(AnnoKeyTitle, v)
}
func (m *grafanaResourceMetaAccessor) SetOriginInfo(info *ResourceOriginInfo) {
	acc, err := meta.Accessor(m.obj)
	if err != nil {
		return
	}

	anno := acc.GetAnnotations()
	if anno == nil {
		if info == nil {
			return
		}
		anno = make(map[string]string, 0)
		acc.SetAnnotations(anno)
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
			anno[AnnoKeyOriginTimestamp] = info.Timestamp.Format(time.RFC3339)
		}
	}
	acc.SetAnnotations(anno)
}

func (m *grafanaResourceMetaAccessor) GetOriginInfo() (*ResourceOriginInfo, error) {
	acc, err := meta.Accessor(m.obj)
	if err != nil {
		return nil, err
	}

	v, ok := acc.GetAnnotations()[AnnoKeyOriginName]
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
	acc, err := meta.Accessor(m.obj)
	if err != nil {
		return nil, err
	}

	v, ok := acc.GetAnnotations()[AnnoKeyOriginTimestamp]
	if !ok || v == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil, fmt.Errorf("invalid origin timestamp: %s", err.Error())
	}
	return &t, nil
}
