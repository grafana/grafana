package resource

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Convert raw resource bytes into an IndexableDocument
type DocumentBuilder interface {
	// Convert raw bytes into an document that can be written
	BuildDocument(ctx context.Context, key *ResourceKey, rv int64, value []byte) (*IndexableDocument, error)
}

// Register how documents can be built for a resource
type DocumentBuilderInfo struct {
	// The target resource (empty will be used to match anything)
	GroupResource schema.GroupResource

	// Defines the searchable fields
	// NOTE: this does not include the root/common fields, only values specific to the the builder
	Fields SearchableDocumentFields

	// simple/static builders that do not depend on the environment can be declared once
	Builder DocumentBuilder

	// Complicated builders (eg dashboards!) will be declared dynamically and managed by the ResourceServer
	Namespaced func(ctx context.Context, namespace string, blob BlobSupport) (DocumentBuilder, error)
}

// IndexableDocument can be written to a ResourceIndex
// Although public, this is *NOT* an end user interface
type IndexableDocument struct {
	// The resource key
	Key *ResourceKey `json:"key"`

	// Resource version for the resource (if known)
	RV int64 `json:"rv,omitempty"`

	// The generic display name
	Title string `json:"title,omitempty"`

	// A generic description -- helpful in global search
	Description string `json:"description,omitempty"`

	// Like dashboard tags
	Tags []string `json:"tags,omitempty"`

	// Generic metadata labels
	Labels map[string]string `json:"labels,omitempty"`

	// The folder (K8s name)
	Folder string `json:"folder,omitempty"`

	// The first time this resource was saved
	Created int64 `json:"created,omitempty"`

	// Who created the resource (will be in the form `user:uid`)
	CreatedBy string `json:"createdBy,omitempty"`

	// The last time a user updated the spec
	Updated int64 `json:"updated,omitempty"`

	// Who updated the resource (will be in the form `user:uid`)
	UpdatedBy string `json:"updatedBy,omitempty"`

	// Searchable nested keys
	// The key should exist from the fields defined in DocumentBuilderInfo
	// This should not contain duplicate information from the results above
	// The meaning of these fields changes depending on the field type
	// These values typically come from the Spec, but may also come from status
	// metadata, annotations, or external data linked at index time
	Fields map[string]any `json:"fields,omitempty"`

	// Maintain a list of resource references.
	// Someday this will likely be part of https://github.com/grafana/gamma
	References []ResourceReference `json:"reference,omitempty"`

	// When the resource is managed by an upstream repository
	RepoInfo *utils.ResourceRepositoryInfo `json:"repository,omitempty"`
}

type ResourceReference struct {
	Relation string `json:"relation"`          // eg: depends-on
	Group    string `json:"group,omitempty"`   // the api group
	Version  string `json:"version,omitempty"` // the api version
	Kind     string `json:"kind,omitempty"`    // panel, data source (for now)
	Name     string `json:"name"`              // the UID / panel name
}

// Create a new indexable document based on a generic k8s resource
func NewIndexableDocument(key *ResourceKey, rv int64, obj utils.GrafanaMetaAccessor) *IndexableDocument {
	doc := &IndexableDocument{
		Key:       key,
		RV:        rv,
		Title:     obj.FindTitle(key.Name), // We always want *something* to display
		Labels:    obj.GetLabels(),
		Folder:    obj.GetFolder(),
		CreatedBy: obj.GetCreatedBy(),
		UpdatedBy: obj.GetUpdatedBy(),
	}
	doc.RepoInfo, _ = obj.GetRepositoryInfo()
	ts := obj.GetCreationTimestamp()
	if !ts.Time.IsZero() {
		doc.Created = ts.Time.UnixMilli()
	}
	tt, err := obj.GetUpdatedTimestamp()
	if err != nil && tt != nil {
		doc.Updated = tt.UnixMilli()
	}
	return doc
}

func StandardDocumentBuilder() DocumentBuilderInfo {
	return DocumentBuilderInfo{
		Builder: &standardDocumentBuilder{},
	}
}

type standardDocumentBuilder struct{}

func (s *standardDocumentBuilder) BuildDocument(ctx context.Context, key *ResourceKey, rv int64, value []byte) (*IndexableDocument, error) {
	tmp := &unstructured.Unstructured{}
	err := tmp.UnmarshalJSON(value)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return nil, err
	}

	doc := NewIndexableDocument(key, rv, obj)
	doc.Title = obj.FindTitle(key.Name)
	return doc, nil
}
