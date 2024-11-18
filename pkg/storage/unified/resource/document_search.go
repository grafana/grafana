package resource

import (
	"fmt"
	"sync"
)

// Registry of the searchable document fields
type SearchableDocumentFields struct {
	names  []string
	fields map[string]*resourceTableColumn
}

// This requires unique names
func NewSearchableDocumentFields(columns []*ResourceTableColumnDefinition) (*SearchableDocumentFields, error) {
	f := &SearchableDocumentFields{
		names:  make([]string, len(columns)),
		fields: make(map[string]*resourceTableColumn),
	}
	for i, c := range columns {
		if f.fields[c.Name] != nil {
			return nil, fmt.Errorf("duplicate name")
		}
		col, err := newResourceTableColumn(c, i)
		if err != nil {
			return nil, err
		}
		f.names[i] = c.Name
		f.fields[c.Name] = col
	}
	return f, nil
}

func (x *SearchableDocumentFields) Fields() []string {
	return x.names
}

func (x *SearchableDocumentFields) Field(name string) *ResourceTableColumnDefinition {
	f, ok := x.fields[name]
	if ok {
		return f.def
	}
	return nil
}

const SEARCH_FIELD_ID = "_id"            // {namespace}/{group}/{resource}/{name}
const SEARCH_FIELD_GROUP_RESOURCE = "gr" // group/resource
const SEARCH_FIELD_NAMESPACE = "namespace"
const SEARCH_FIELD_NAME = "name"
const SEARCH_FIELD_RV = "rv"
const SEARCH_FIELD_TITLE = "title"
const SEARCH_FIELD_DESCRIPTION = "description"
const SEARCH_FIELD_TAGS = "tags"
const SEARCH_FIELD_LABELS = "labels" // All labels, not a specific one

const SEARCH_FIELD_FOLDER = "folder"
const SEARCH_FIELD_CREATED = "created"
const SEARCH_FIELD_CREATED_BY = "createdBy"
const SEARCH_FIELD_UPDATED = "updated"
const SEARCH_FIELD_UPDATED_BY = "updatedBy"
const SEARCH_FIELD_REPOSITORY = "repository"
const SEARCH_FIELD_REPOSITORY_HASH = "repository_hash"

const SEARCH_FIELD_SCORE = "_score"     // the match score
const SEARCH_FIELD_EXPLAIN = "_explain" // score explanation as JSON object

var standardSearchFieldsInit sync.Once
var standardSearchFields *SearchableDocumentFields

func StandardSearchFields() *SearchableDocumentFields {
	standardSearchFieldsInit.Do(func() {
		var err error
		standardSearchFields, err = NewSearchableDocumentFields([]*ResourceTableColumnDefinition{
			{
				Name:        SEARCH_FIELD_ID,
				Type:        ResourceTableColumnDefinition_STRING,
				Description: "Unique Identifier. {namespace}/{group}/{resource}/{name}",
				Properties: &ResourceTableColumnDefinition_Properties{
					NotNull: true,
				},
			},
			{
				Name:        SEARCH_FIELD_GROUP_RESOURCE,
				Type:        ResourceTableColumnDefinition_STRING,
				Description: "The resource kind: {group}/{resource}",
				Properties: &ResourceTableColumnDefinition_Properties{
					NotNull: true,
				},
			},
			{
				Name:        SEARCH_FIELD_NAMESPACE,
				Type:        ResourceTableColumnDefinition_STRING,
				Description: "Tenant isolation",
				Properties: &ResourceTableColumnDefinition_Properties{
					NotNull: true,
				},
			},
			{
				Name:        SEARCH_FIELD_NAME,
				Type:        ResourceTableColumnDefinition_STRING,
				Description: "Kubernetes name.  Unique identifier within a namespace+group+resource",
				Properties: &ResourceTableColumnDefinition_Properties{
					NotNull: true,
				},
			},
			{
				Name:        SEARCH_FIELD_TITLE,
				Type:        ResourceTableColumnDefinition_STRING,
				Description: "Display name for the resource",
			},
			{
				Name:        SEARCH_FIELD_DESCRIPTION,
				Type:        ResourceTableColumnDefinition_STRING,
				Description: "An account of the resource.",
				Properties: &ResourceTableColumnDefinition_Properties{
					FreeText: true,
				},
			},
		})
		if err != nil {
			panic("failed to initialize standard search fields")
		}
	})
	return standardSearchFields
}

// // Helper function to convert everything except the "Fields" property to values
// // NOTE: this is really to help testing things absent real backend index
// func IndexableDocumentStandardFields(doc *IndexableDocument) map[string]any {
// 	fields := make(map[string]any)

// 	// These should always exist
// 	fields[SEARCH_FIELD_ID] = doc.Key.SearchID()
// 	fields[SEARCH_FIELD_NAMESPACE] = doc.Key.Namespace
// 	fields[SEARCH_FIELD_NAME] = doc.Key.Name
// 	fields[SEARCH_FIELD_GROUP_RESOURCE] = fmt.Sprintf("%s/%s", doc.Key.Group, doc.Key.Resource)

// 	fields[SEARCH_FIELD_TITLE] = doc.Title

// 	return fields
// }
