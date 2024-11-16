package resource

import (
	"context"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

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

	// The standard/common indexable metadata
	Meta StandardDocumentMetadata `json:"meta,omitempty"`

	// Searchable nested keys
	// The key should exist from the fields defined in DocumentBuilderInfo
	// This should not contain duplicate information from the results above
	// The meaning of these fields changes depending on the field type
	// These values typically come from the Spec, but may also come from status
	Values map[string]any `json:"values,omitempty"`

	// Maintain a list of resource references.
	// Someday this will likely be part of https://github.com/grafana/gamma
	References []ResourceReference `json:"reference,omitempty"`
}

// Create a new indexable document based on a generic k8s resource
func NewIndexableDocument(key *ResourceKey, rv int64, obj utils.GrafanaMetaAccessor) *IndexableDocument {
	doc := &IndexableDocument{
		Key:    key,
		RV:     rv,
		Title:  obj.FindTitle(key.Name), // We always want *something* to display
		Labels: obj.GetLabels(),
		Meta: StandardDocumentMetadata{
			Folder:    obj.GetFolder(),
			CreatedBy: obj.GetCreatedBy(),
			UpdatedBy: obj.GetUpdatedBy(),
		},
	}
	doc.Meta.RepoInfo, _ = obj.GetRepositoryInfo()
	ts := obj.GetCreationTimestamp()
	if !ts.Time.IsZero() {
		doc.Meta.Created = ts.Time.UnixMilli()
	}
	tt, err := obj.GetUpdatedTimestamp()
	if err != nil && tt != nil {
		doc.Meta.Updated = tt.UnixMilli()
	}
	return doc
}

type StandardDocumentMetadata struct {
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

	// When the resource is managed by an upstream repository
	RepoInfo *utils.ResourceRepositoryInfo `json:"repository,omitempty"`
}

type ResourceReference struct {
	Relation string `json:"relation"` // depends-on
	Group    string `json:"group,omitempty"`
	Version  string `json:"version,omitempty"`
	Kind     string `json:"kind,omitempty"` // panel, data source (for now)
	Name     string `json:"name"`           // the UID / panel name
}

// Convert raw resource bytes into an IndexableDocument
type DocumentBuilder interface {
	// Convert raw bytes into an document that can be written
	BuildDocument(ctx context.Context, key *ResourceKey, rv int64, value []byte) (*IndexableDocument, error)
}

// Register how documents can be built for a resource
type DocumentBuilderInfo struct {
	// The target resource (empty will be used to match anything)
	GroupResource schema.GroupResource

	// Defines how to interpret the non-standard fields from the IndexableDocument
	FieldDefinitions []*ResourceTableColumnDefinition

	// simple/static builders that do not depend on the environment can be declared once
	Builder DocumentBuilder

	// Complicated builders (eg dashboards!) will be declared dynamically and managed by the ResourceServer
	Namespaced func(ctx context.Context, namespace string, blob BlobSupport) (DocumentBuilder, error)
}

type StandardDocumentBuilder interface {
	// Check if a name is in use
	IsFieldNameUsed(f string) bool

	// Get a builder that does not require context
	Builder() DocumentBuilder
}

var (
	docFieldInit sync.Once
	docBuilder   *standardDocumentBuilder
)

// The unique string key that can identify a document
func ToDocumentID(key *ResourceKey) string {
	var sb strings.Builder
	if key.Namespace == "" {
		sb.WriteString("cluster**")
	} else {
		sb.WriteString(key.Namespace)
	}
	sb.WriteString("/")
	sb.WriteString(key.Group)
	sb.WriteString("/")
	sb.WriteString(key.Resource)
	sb.WriteString("/")
	sb.WriteString(key.Name)
	return sb.String()
}

// The set of standard fields and how they get re
func GetStandardDocumentBuilder() StandardDocumentBuilder {
	docFieldInit.Do(func() {
		docBuilder = &standardDocumentBuilder{
			lookup: make(map[string]*standardDocumentField, 30),
		}

		// The KEY Based fields
		//----------------------------------------------
		docBuilder.register(func(doc *IndexableDocument) any {
			return ToDocumentID(doc.Key)
		}, &ResourceTableColumnDefinition{
			Name:        "id",
			Type:        ResourceTableColumnDefinition_STRING,
			Description: "Unique Identifier.",
		})
		docBuilder.register(func(doc *IndexableDocument) any {
			return doc.Key.Namespace
		}, &ResourceTableColumnDefinition{
			Name:        "namespace",
			Type:        ResourceTableColumnDefinition_STRING,
			Description: "namespace enforces tenant isolation.",
		})
		docBuilder.register(func(doc *IndexableDocument) any {
			return doc.Key.Group
		}, &ResourceTableColumnDefinition{
			Name:        "group",
			Type:        ResourceTableColumnDefinition_STRING,
			Description: "Group is the k8s apiserver",
		})
		docBuilder.register(func(doc *IndexableDocument) any {
			return doc.Key.Resource
		}, &ResourceTableColumnDefinition{
			Name:        "resource",
			Type:        ResourceTableColumnDefinition_STRING,
			Description: "Resource defines the kind",
		})
		docBuilder.register(func(doc *IndexableDocument) any {
			return doc.Key.Name
		}, &ResourceTableColumnDefinition{
			Name:        "name",
			Type:        ResourceTableColumnDefinition_STRING,
			Description: "The unique identifier within namespace/group+resource",
		})

		docBuilder.register(func(doc *IndexableDocument) any {
			return doc.RV
		}, &ResourceTableColumnDefinition{
			Name:        "rv",
			Type:        ResourceTableColumnDefinition_INT64,
			Description: "The resource version",
		})

		// Common metadata fields
		//----------------------------------------------
		docBuilder.register(func(doc *IndexableDocument) any {
			return doc.Title
		}, &ResourceTableColumnDefinition{
			Name:        "title",
			Type:        ResourceTableColumnDefinition_STRING,
			Description: "The resource display name",
		})
		docBuilder.register(func(doc *IndexableDocument) any {
			return doc.Description
		}, &ResourceTableColumnDefinition{
			Name: "description",
			Type: ResourceTableColumnDefinition_STRING,
			Properties: &ResourceTableColumnDefinition_Properties{
				FreeText: true, // Make this field free text searchable
			}})
		docBuilder.register(func(doc *IndexableDocument) any {
			return doc.Tags
		}, &ResourceTableColumnDefinition{
			Name:    "tags",
			Type:    ResourceTableColumnDefinition_STRING,
			IsArray: true,
			Properties: &ResourceTableColumnDefinition_Properties{
				Filterable: true, // really helpful for filtering/faceting
			}})

		docBuilder.register(func(doc *IndexableDocument) any {
			// ??? Returning the full labels object is likely helpful
			// but indexing/search we will want each label indexed independently
			return doc.Labels
		}, &ResourceTableColumnDefinition{
			Name: "labels",
			Type: ResourceTableColumnDefinition_OBJECT,
		})

		// 	{
		// 		getter: func(doc *IndexableDocument) any {
		// 			return doc.Meta.Folder
		// 		},
		// 		ResourceTableColumnDefinition: &ResourceTableColumnDefinition{
		// 			Name:        "folder",
		// 			Type:        ResourceTableColumnDefinition_STRING,
		// 			Description: "the k8s name that this resource lives in",
		// 		},
		// 	},
		// 	{
		// 		getter: func(doc *IndexableDocument) any {
		// 			if doc.Meta.Created > 0 {
		// 				return time.UnixMilli(doc.Meta.Created)
		// 			}
		// 			return nil
		// 		},
		// 		ResourceTableColumnDefinition: &ResourceTableColumnDefinition{
		// 			Name:        "created",
		// 			Type:        ResourceTableColumnDefinition_DATE_TIME,
		// 			Description: "when the resource was first saved",
		// 		},
		// 	},
		// 	{
		// 		getter: func(doc *IndexableDocument) any {
		// 			if doc.Meta.Updated > 0 {
		// 				return time.UnixMilli(doc.Meta.Updated)
		// 			}
		// 			return nil
		// 		},
		// 		ResourceTableColumnDefinition: &ResourceTableColumnDefinition{
		// 			Name:        "updated",
		// 			Type:        ResourceTableColumnDefinition_DATE_TIME,
		// 			Description: "when the resource was last updated",
		// 		},
		// 	},
		// 	{
		// 		getter: func(doc *IndexableDocument) any {
		// 			return doc.Meta.CreatedBy
		// 		},
		// 		ResourceTableColumnDefinition: &ResourceTableColumnDefinition{
		// 			Name:        "created_by",
		// 			Type:        ResourceTableColumnDefinition_STRING,
		// 			Description: "who created the resource",
		// 		},
		// 	},
		// 	{
		// 		getter: func(doc *IndexableDocument) any {
		// 			return doc.Meta.CreatedBy
		// 		},
		// 		ResourceTableColumnDefinition: &ResourceTableColumnDefinition{
		// 			Name:        "updated_by",
		// 			Type:        ResourceTableColumnDefinition_STRING,
		// 			Description: "who updated the resource",
		// 		},
		// 	},

		// 	{
		// 		getter: func(doc *IndexableDocument) any {
		// 			r := doc.Meta.RepoInfo
		// 			if r == nil || r.Name == "" {
		// 				return nil
		// 			}
		// 			return r.Name
		// 		},
		// 		ResourceTableColumnDefinition: &ResourceTableColumnDefinition{
		// 			Name:        "repo_name",
		// 			Type:        ResourceTableColumnDefinition_STRING,
		// 			Description: "who updated the resource",
		// 		},
		// 	},
		// 	{
		// 		getter: func(doc *IndexableDocument) any {
		// 			r := doc.Meta.RepoInfo
		// 			if r == nil || r.Name == "" {
		// 				return nil
		// 			}
		// 			return r.Hash
		// 		},
		// 		ResourceTableColumnDefinition: &ResourceTableColumnDefinition{
		// 			Name:        "repo_hash",
		// 			Type:        ResourceTableColumnDefinition_STRING,
		// 			Description: "The hash on the upstream repository",
		// 		},
		// 	},
		// }
	})
	return docBuilder
}

type standardDocumentField struct {
	*ResourceTableColumn

	getter func(doc *IndexableDocument) any
}

type standardDocumentBuilder struct {
	lookup map[string]*standardDocumentField
}

func (s *standardDocumentBuilder) register(getter func(*IndexableDocument) any, def *ResourceTableColumnDefinition) {
	if s.lookup[def.Name] != nil {
		panic("duplicate standard field found: " + def.Name)
	}
	c, err := NewResourceTableColumn(def, 0)
	if err != nil {
		panic("error initializing standard field " + def.Name)
	}
	s.lookup[def.Name] = &standardDocumentField{
		getter:              getter,
		ResourceTableColumn: c,
	}
}

// // Check if a name is in use
//

// // Get a builder that does not require context
//

func (s *standardDocumentBuilder) IsFieldNameUsed(field string) bool {
	_, ok := s.lookup[field]
	if !ok {
		if strings.HasPrefix(field, "labels") {
			return true
		}
	}
	return ok
}

func (s *standardDocumentBuilder) Builder() DocumentBuilder {
	return s
}

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
