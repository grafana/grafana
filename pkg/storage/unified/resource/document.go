package resource

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Convert raw resource bytes into an IndexableDocument
type DocumentBuilder interface {
	// Convert raw bytes into an document that can be written
	BuildDocument(ctx context.Context, key *ResourceKey, rv int64, value []byte) (*IndexableDocument, error)
}

// Registry of the searchable document fields
type SearchableDocumentFields interface {
	Fields() []string
	Field(name string) *ResourceTableColumnDefinition
}

// Some kinds will require special processing for their namespace
type NamespacedDocumentSupplier = func(ctx context.Context, namespace string, blob BlobSupport) (DocumentBuilder, error)

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
	Namespaced NamespacedDocumentSupplier
}

type DocumentBuilderSupplier interface {
	GetDocumentBuilders() ([]DocumentBuilderInfo, error)
}

// IndexableDocument can be written to a ResourceIndex
// Although public, this is *NOT* an end user interface
type IndexableDocument struct {
	// The resource key
	Key *ResourceKey `json:"key"`

	// The k8s name
	Name string `json:"name,omitempty"`

	// Resource version for the resource (if known)
	RV int64 `json:"rv,omitempty"`

	// The generic display name
	Title string `json:"title,omitempty"`

	// internal field for searching title with ngrams
	TitleNgram string `json:"title_ngram,omitempty"`

	// internal sort field for title ( don't set this directly )
	TitlePhrase string `json:"title_phrase,omitempty"`

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
	References ResourceReferences `json:"reference,omitempty"`

	// When the resource is managed by an upstream repository
	Manager *utils.ManagerProperties `json:"manager,omitempty"`

	// indexed only field for faceting manager info
	ManagedBy string `json:"managedBy,omitempty"`

	// When the manager knows about file paths
	Source *utils.SourceProperties `json:"source,omitempty"`
}

func (m *IndexableDocument) UpdateCopyFields() *IndexableDocument {
	m.TitleNgram = m.Title
	m.TitlePhrase = strings.ToLower(m.Title) // Lowercase for case-insensitive sorting ?? in the analyzer?
	if m.Manager != nil {
		m.ManagedBy = fmt.Sprintf("%s:%s", m.Manager.Kind, m.Manager.Identity)
	}
	return m
}

func (m *IndexableDocument) Type() string {
	return m.Key.Resource
}

type ResourceReference struct {
	Relation string `json:"relation"`          // eg: depends-on
	Group    string `json:"group,omitempty"`   // the api group
	Version  string `json:"version,omitempty"` // the api version
	Kind     string `json:"kind,omitempty"`    // panel, data source (for now)
	Name     string `json:"name"`              // the UID / panel name
}

func (m ResourceReference) String() string {
	var sb strings.Builder
	sb.WriteString(m.Relation)
	sb.WriteString(">>")
	sb.WriteString(m.Group)
	if m.Version != "" {
		sb.WriteString("/")
		sb.WriteString(m.Version)
	}
	if m.Kind != "" {
		sb.WriteString("/")
		sb.WriteString(m.Kind)
	}
	sb.WriteString("/")
	sb.WriteString(m.Name)
	return sb.String()
}

// Sortable list of references
type ResourceReferences []ResourceReference

func (m ResourceReferences) Len() int      { return len(m) }
func (m ResourceReferences) Swap(i, j int) { m[i], m[j] = m[j], m[i] }
func (m ResourceReferences) Less(i, j int) bool {
	a := m[i].String()
	b := m[j].String()
	return strings.Compare(a, b) > 0
}

// Create a new indexable document based on a generic k8s resource
func NewIndexableDocument(key *ResourceKey, rv int64, obj utils.GrafanaMetaAccessor) *IndexableDocument {
	title := obj.FindTitle(key.Name)
	if title == key.Name {
		// TODO: something wrong with FindTitle
		spec, err := obj.GetSpec()
		if err == nil {
			specValue, ok := spec.(map[string]any)
			if ok {
				specTitle, ok := specValue["title"].(string)
				if ok {
					title = specTitle
				}
			}
		}
	}
	doc := &IndexableDocument{
		Key:       key,
		RV:        rv,
		Name:      key.Name,
		Title:     title, // We always want *something* to display
		Labels:    obj.GetLabels(),
		Folder:    obj.GetFolder(),
		CreatedBy: obj.GetCreatedBy(),
		UpdatedBy: obj.GetUpdatedBy(),
	}
	m, ok := obj.GetManagerProperties()
	if ok {
		doc.Manager = &m
		doc.ManagedBy = fmt.Sprintf("%s:%s", m.Kind, m.Identity)
	}
	s, ok := obj.GetSourceProperties()
	if ok {
		doc.Source = &s
	}
	ts := obj.GetCreationTimestamp()
	if !ts.Time.IsZero() {
		doc.Created = ts.UnixMilli()
	}
	tt, err := obj.GetUpdatedTimestamp()
	if err != nil && tt != nil {
		doc.Updated = tt.UnixMilli()
	}
	return doc.UpdateCopyFields()
}

func StandardDocumentBuilder() DocumentBuilder {
	return &standardDocumentBuilder{}
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
	return doc, nil
}

type searchableDocumentFields struct {
	names  []string
	fields map[string]*resourceTableColumn
}

// This requires unique names
func NewSearchableDocumentFields(columns []*ResourceTableColumnDefinition) (SearchableDocumentFields, error) {
	f := &searchableDocumentFields{
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

func (x *searchableDocumentFields) Fields() []string {
	return x.names
}

func (x *searchableDocumentFields) Field(name string) *ResourceTableColumnDefinition {
	name = strings.TrimPrefix(name, SEARCH_FIELD_PREFIX)

	f, ok := x.fields[name]
	if ok {
		return f.def
	}
	return nil
}

const SEARCH_FIELD_PREFIX = "fields."
const SEARCH_FIELD_ID = "_id" // {namespace}/{group}/{resource}/{name}
const SEARCH_FIELD_LEGACY_ID = utils.LabelKeyDeprecatedInternalID
const SEARCH_FIELD_KIND = "kind"         // resource ( for federated index filtering )
const SEARCH_FIELD_GROUP_RESOURCE = "gr" // group/resource
const SEARCH_FIELD_NAMESPACE = "namespace"
const SEARCH_FIELD_NAME = "name"
const SEARCH_FIELD_RV = "rv"
const SEARCH_FIELD_TITLE = "title"
const SEARCH_FIELD_TITLE_NGRAM = "title_ngram"
const SEARCH_FIELD_TITLE_PHRASE = "title_phrase" // filtering/sorting on title by full phrase
const SEARCH_FIELD_DESCRIPTION = "description"
const SEARCH_FIELD_TAGS = "tags"
const SEARCH_FIELD_LABELS = "labels" // All labels, not a specific one

const SEARCH_FIELD_FOLDER = "folder"
const SEARCH_FIELD_CREATED = "created"
const SEARCH_FIELD_CREATED_BY = "createdBy"
const SEARCH_FIELD_UPDATED = "updated"
const SEARCH_FIELD_UPDATED_BY = "updatedBy"

const SEARCH_FIELD_MANAGED_BY = "managedBy" // {kind}:{id}
const SEARCH_FIELD_MANAGER_KIND = "manager.kind"
const SEARCH_FIELD_MANAGER_ID = "manager.id"
const SEARCH_FIELD_SOURCE_PATH = "source.path"
const SEARCH_FIELD_SOURCE_CHECKSUM = "source.checksum"
const SEARCH_FIELD_SOURCE_TIME = "source.timestampMillis"

const SEARCH_FIELD_SCORE = "_score"     // the match score
const SEARCH_FIELD_EXPLAIN = "_explain" // score explanation as JSON object

var standardSearchFieldsInit sync.Once
var standardSearchFields SearchableDocumentFields

func StandardSearchFields() SearchableDocumentFields {
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
			{
				Name:        SEARCH_FIELD_TAGS,
				Type:        ResourceTableColumnDefinition_STRING,
				IsArray:     true,
				Description: "Unique tags",
				Properties: &ResourceTableColumnDefinition_Properties{
					Filterable: true,
				},
			},
			{
				Name:        SEARCH_FIELD_FOLDER,
				Type:        ResourceTableColumnDefinition_STRING,
				Description: "Kubernetes name for the folder",
			},
			{
				Name:        SEARCH_FIELD_RV,
				Type:        ResourceTableColumnDefinition_INT64,
				Description: "resource version",
			},
			{
				Name:        SEARCH_FIELD_CREATED,
				Type:        ResourceTableColumnDefinition_INT64,
				Description: "created timestamp", // date?
			},
			{
				Name:        SEARCH_FIELD_EXPLAIN,
				Type:        ResourceTableColumnDefinition_OBJECT,
				Description: "Explain why this result matches (depends on the engine)",
			},
			{
				Name:        SEARCH_FIELD_SCORE,
				Type:        ResourceTableColumnDefinition_DOUBLE,
				Description: "The search score",
			},
			{
				Name:        SEARCH_FIELD_LEGACY_ID,
				Type:        ResourceTableColumnDefinition_INT64,
				Description: "Deprecated legacy id of the resource",
			},
			{
				Name:        SEARCH_FIELD_MANAGER_KIND,
				Type:        ResourceTableColumnDefinition_STRING,
				Description: "Type of manager, which is responsible for managing the resource",
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
