package resource

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Convert raw resource bytes into an IndexableDocument
type DocumentBuilder interface {
	// Convert raw bytes into an document that can be written
	BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*IndexableDocument, error)
}

// Registry of the searchable document fields
type SearchableDocumentFields interface {
	Fields() []string
	Field(name string) *resourcepb.ResourceTableColumnDefinition
}

// Some kinds will require special processing for their namespace
type NamespacedDocumentSupplier = func(ctx context.Context, namespace string, blob BlobSupport) (DocumentBuilder, error)

// Register how documents can be built for a resource
type DocumentBuilderInfo struct {
	// The target resource (empty will be used to match anything)
	GroupResource schema.GroupResource

	// simple/static builders that do not depend on the environment can be declared once
	Builder DocumentBuilder

	// Complicated builders (eg dashboards!) will be declared dynamically and managed by the ResourceServer
	Namespaced NamespacedDocumentSupplier
}

// SearchableFieldsFromProvider returns the column-definition view of a kind's
// custom search fields for the given group and resource, derived from the
// provider. The provider is the single source of truth; the search backend
// uses this view for result column metadata and sort-field prefixing. Returns
// nil when the provider is nil.
func SearchableFieldsFromProvider(p SearchFieldsProvider, group, resource string) (SearchableDocumentFields, error) {
	if p == nil {
		return nil, nil
	}
	sfds := p.Fields(schema.GroupVersionResource{
		Group:    group,
		Resource: resource,
	})
	return NewSearchableDocumentFields(SearchFieldDefinitionsToTableColumns(sfds))
}

type DocumentBuilderSupplier interface {
	GetDocumentBuilders(registry *SearchFieldsRegistry) ([]DocumentBuilderInfo, error)
}

// IndexableDocument can be written to a ResourceIndex
// Although public, this is *NOT* an end user interface
type IndexableDocument struct {
	// The resource key
	Key *resourcepb.ResourceKey `json:"key"`

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

	// Selectable fields used for field-based filtering when listing.
	// Standard document builder automatically adds all selectable fields from document here.
	SelectableFields map[string]string `json:"selectableFields,omitempty"`

	// The list of owner references,
	// each value is of the form {group}/{kind}/{name}
	// ex: iam.grafana.app/Team/abc-engineering
	OwnerReferences []string `json:"ownerReferences,omitempty"`

	// Maintain a list of resource references.
	// Someday this will likely be part of https://github.com/grafana/gamma
	References ResourceReferences `json:"references,omitempty"`

	// internal field for mapping references to kind ( don't set this directly )
	Reference map[string][]string `json:"reference,omitempty"` // map of kind to list of names

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

	m.Reference = make(map[string][]string)
	for _, ref := range m.References {
		// Group and Version are ignored for now. This could be revisited.
		m.Reference[ref.Kind] = append(m.Reference[ref.Kind], ref.Name)
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

// NewIndexableDocument creates a new indexable document based on a generic k8s resource
// If title is empty, resolve it by calling obj.FindTitle and obj.GetSpec (in that order)
func NewIndexableDocument(key *resourcepb.ResourceKey, rv int64, obj utils.GrafanaMetaAccessor, title string) *IndexableDocument {
	if title == "" {
		title = obj.FindTitle(key.Name)
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
	for _, owner := range obj.GetOwnerReferences() {
		gv, err := schema.ParseGroupVersion(owner.APIVersion)
		if err == nil {
			doc.OwnerReferences = append(doc.OwnerReferences, fmt.Sprintf("%s/%s/%s", gv.Group, owner.Kind, owner.Name))
		}
	}
	return doc.UpdateCopyFields()
}

// StandardDocumentBuilder returns the standard document builder backed by the
// shared registry, so a runtime manifest reload is reflected without rebuilding
// the builder.
func StandardDocumentBuilder(registry *SearchFieldsRegistry) DocumentBuilder {
	return &standardDocumentBuilder{
		registry: registry,
		log:      log.New("resource.document-builder"),
	}
}

type standardDocumentBuilder struct {
	// registry is the shared source for selectable fields and search-field
	// providers; may be nil (then the builder extracts neither).
	registry *SearchFieldsRegistry
	log      log.Logger
}

func (s *standardDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*IndexableDocument, error) {
	tmp := &unstructured.Unstructured{}
	err := tmp.UnmarshalJSON(value)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return nil, err
	}

	doc := NewIndexableDocument(key, rv, obj, "")

	if s.registry == nil {
		return doc, nil
	}

	sfKey := NewLowerGroupResource(key.GetGroup(), key.GetResource())
	selectable, _, provider := s.registry.For(sfKey)
	doc.SelectableFields = getSelectableFieldsFromObject(tmp, selectable)

	if provider != nil {
		s.extractDeclaredFields(provider, tmp, key, doc)
	}

	return doc, nil
}

// extractDeclaredFields populates doc.Fields from SearchFieldDefinitions
// declared via the provider. The lookup is strict on apiVersion: a manifest
// must declare every served version of a kind if it expects all stored
// resources to be indexed against the same field set. Cross-version
// fallback can silently extract an old document with a newer version's path
// declarations when the schema diverges, so the builder leaves that
// decision to manifest authors.
func (s *standardDocumentBuilder) extractDeclaredFields(provider SearchFieldsProvider, tmp *unstructured.Unstructured, key *resourcepb.ResourceKey, doc *IndexableDocument) {
	gvr := gvrForLookup(tmp, key, provider)
	if gvr.Resource == "" {
		return
	}
	defs := provider.Fields(gvr)
	if len(defs) == 0 {
		return
	}
	for _, def := range defs {
		if def.Path == "" {
			continue
		}
		raw, err := extractPath(tmp.Object, def.Path)
		if err != nil {
			s.log.Warn("declared search field path failed to evaluate",
				"group", gvr.Group, "version", gvr.Version, "resource", gvr.Resource,
				"field", def.Name, "path", def.Path, "err", err)
			continue
		}
		if raw == nil {
			if !def.EmitZeroIfAbsent {
				continue
			}
			if doc.Fields == nil {
				doc.Fields = make(map[string]any)
			}
			doc.Fields[def.Name] = zeroValueForFieldDefinition(def)
			continue
		}
		coerced, ok := coerceToFieldShape(raw, def.Type, def.Array)
		if !ok {
			s.log.Warn("declared search field value does not match declared type",
				"group", gvr.Group, "version", gvr.Version, "resource", gvr.Resource,
				"field", def.Name, "type", def.Type, "array", def.Array,
				"value_type", fmt.Sprintf("%T", raw))
			continue
		}
		if doc.Fields == nil {
			doc.Fields = make(map[string]any)
		}
		doc.Fields[def.Name] = coerced
	}
}

// zeroValueForFieldDefinition returns the type-appropriate zero value for a
// declared field. Used when Path resolves to nil and EmitZeroIfAbsent is set,
// so the indexed document still carries the field. Returns nil for unknown
// types so the caller drops the field instead of indexing a typeless value.
func zeroValueForFieldDefinition(def SearchFieldDefinition) any {
	if def.Array {
		return []any{}
	}
	switch def.Type {
	case SearchFieldTypeBoolean:
		return false
	case SearchFieldTypeInt64:
		return int64(0)
	case SearchFieldTypeDouble:
		return float64(0)
	case SearchFieldTypeString, SearchFieldTypeDate:
		return ""
	case SearchFieldTypeUnknown:
		return nil
	}
	return nil
}

// gvrForLookup resolves the GroupVersionResource the provider should be
// queried with. The lookup is strict on a declared apiVersion: if the
// document carries one and the manifest does not cover that exact version,
// no extraction happens. (Falling back across versions could silently
// extract via a diverged schema, so manifest authors are expected to
// declare every served version.) Only when the document has no apiVersion
// at all do we fall back to the provider's PreferredVersion as the only
// sane guess.
func gvrForLookup(tmp *unstructured.Unstructured, key *resourcepb.ResourceKey, provider SearchFieldsProvider) schema.GroupVersionResource {
	group := key.GetGroup()
	resource := key.GetResource()
	if version := apiVersionOf(tmp); version != "" {
		return schema.GroupVersionResource{Group: group, Version: version, Resource: resource}
	}
	pref := provider.PreferredVersion(group, resource)
	if pref == "" {
		return schema.GroupVersionResource{}
	}
	return schema.GroupVersionResource{Group: group, Version: pref, Resource: resource}
}

func apiVersionOf(tmp *unstructured.Unstructured) string {
	av := tmp.GetAPIVersion()
	if av == "" {
		return ""
	}
	// apiVersion is "<group>/<version>" for non-core resources and just
	// "<version>" for core. The Group is authoritative from the key; we
	// only need the version segment.
	if i := strings.IndexByte(av, '/'); i >= 0 {
		return av[i+1:]
	}
	return av
}

func getSelectableFieldsFromObject(tmp *unstructured.Unstructured, fields []string) map[string]string {
	result := map[string]string{}

	for _, field := range fields {
		path := strings.Split(field, ".")
		val, ok, err := unstructured.NestedFieldNoCopy(tmp.Object, path...)
		if err != nil || !ok {
			continue
		}

		switch v := val.(type) {
		case string:
			result[field] = v
		case bool:
			result[field] = strconv.FormatBool(v)
		default:
			// In practice there should only be strings, bools and int/float selectable fields.
			result[field] = fmt.Sprintf("%v", v)
		}
	}

	return result
}

type searchableDocumentFields struct {
	names  []string
	fields map[string]*resourceTableColumn
}

// This requires unique names
func NewSearchableDocumentFields(columns []*resourcepb.ResourceTableColumnDefinition) (SearchableDocumentFields, error) {
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

func (x *searchableDocumentFields) Field(name string) *resourcepb.ResourceTableColumnDefinition {
	name = strings.TrimPrefix(name, SEARCH_FIELD_PREFIX)

	f, ok := x.fields[name]
	if ok {
		return f.def
	}
	return nil
}

const (
	SEARCH_FIELD_PREFIX             = "fields."
	SEARCH_FIELD_ID                 = "_id" // {namespace}/{group}/{resource}/{name}
	SEARCH_FIELD_LEGACY_ID          = utils.LabelKeyDeprecatedInternalID
	SEARCH_FIELD_KIND               = "kind" // resource ( for federated index filtering )
	SEARCH_FIELD_GROUP_RESOURCE     = "gr"   // group/resource
	SEARCH_FIELD_NAMESPACE          = "namespace"
	SEARCH_FIELD_NAME               = "name"
	SEARCH_FIELD_RV                 = "rv"
	SEARCH_FIELD_TITLE              = "title"        // standard-analyzed title for full-token search; indexed terms are lowercased by the analyzer
	SEARCH_FIELD_TITLE_PHRASE       = "title_phrase" // keyword-analyzed title for exact matching/sorting; value is lowercased in UpdateCopyFields
	SEARCH_FIELD_TITLE_NGRAM        = "title_ngram"  // ngram-analyzed title for partial matching; indexed terms are lowercased by the analyzer
	SEARCH_FIELD_DESCRIPTION        = "description"
	SEARCH_FIELD_TAGS               = "tags"
	SEARCH_FIELD_LABELS             = "labels" // All labels, not a specific one
	SEARCH_FIELD_OWNER_REFERENCES   = "ownerReferences"
	SEARCH_FIELD_FOLDER             = "folder"
	SEARCH_FIELD_CREATED            = "created"
	SEARCH_FIELD_CREATED_BY         = "createdBy"
	SEARCH_FIELD_UPDATED            = "updated"
	SEARCH_FIELD_UPDATED_BY         = "updatedBy"
	SEARCH_FIELD_MANAGED_BY         = "managedBy" // {kind}:{id}
	SEARCH_FIELD_MANAGER_KIND       = "manager.kind"
	SEARCH_FIELD_MANAGER_ID         = "manager.id"
	SEARCH_FIELD_SOURCE_PATH        = "source.path"
	SEARCH_FIELD_SOURCE_CHECKSUM    = "source.checksum"
	SEARCH_FIELD_SOURCE_TIME        = "source.timestampMillis"
	SEARCH_FIELD_SCORE              = "_score"            // the match score
	SEARCH_FIELD_EXPLAIN            = "_explain"          // score explanation as JSON object
	SEARCH_FIELD_ALL_FIELDS         = "_all_columns"      // sentinel: return all known columns in search results (deliberately distinct from bleve's "_all" composite field)
	SEARCH_SELECTABLE_FIELDS_PREFIX = "selectableFields." // Prefix for searching selectable fields.
)

var standardSearchFieldsInit sync.Once
var standardSearchFields SearchableDocumentFields

func StandardSearchFields() SearchableDocumentFields {
	standardSearchFieldsInit.Do(func() {
		var err error
		standardSearchFields, err = NewSearchableDocumentFields([]*resourcepb.ResourceTableColumnDefinition{
			{
				Name:        SEARCH_FIELD_ID,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				Description: "Unique Identifier. {namespace}/{group}/{resource}/{name}",
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					NotNull: true,
				},
			},
			{
				Name:        SEARCH_FIELD_GROUP_RESOURCE,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				Description: "The resource kind: {group}/{resource}",
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					NotNull: true,
				},
			},
			{
				Name:        SEARCH_FIELD_NAMESPACE,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				Description: "Tenant isolation",
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					NotNull: true,
				},
			},
			{
				Name:        SEARCH_FIELD_NAME,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				Description: "Kubernetes name.  Unique identifier within a namespace+group+resource",
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					NotNull: true,
				},
			},
			{
				Name:        SEARCH_FIELD_TITLE,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				Description: "Display name for the resource",
			},
			{
				Name:        SEARCH_FIELD_DESCRIPTION,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				Description: "An account of the resource.",
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					FreeText: true,
				},
			},
			{
				Name:        SEARCH_FIELD_TAGS,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				IsArray:     true,
				Description: "Unique tags",
				Properties: &resourcepb.ResourceTableColumnDefinition_Properties{
					Filterable: true,
				},
			},
			{
				Name:        SEARCH_FIELD_FOLDER,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				Description: "Kubernetes name for the folder",
			},
			{
				Name:        SEARCH_FIELD_RV,
				Type:        resourcepb.ResourceTableColumnDefinition_INT64,
				Description: "resource version",
			},
			{
				Name:        SEARCH_FIELD_CREATED,
				Type:        resourcepb.ResourceTableColumnDefinition_INT64,
				Description: "created timestamp (unix millis)",
			},
			{
				Name:        SEARCH_FIELD_UPDATED,
				Type:        resourcepb.ResourceTableColumnDefinition_INT64,
				Description: "updated timestamp (unix millis)",
			},
			{
				Name:        SEARCH_FIELD_CREATED_BY,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				Description: "Who created the resource (format: user:<uid>)",
			},
			{
				Name:        SEARCH_FIELD_EXPLAIN,
				Type:        resourcepb.ResourceTableColumnDefinition_OBJECT,
				Description: "Explain why this result matches (depends on the engine)",
			},
			{
				Name:        SEARCH_FIELD_SCORE,
				Type:        resourcepb.ResourceTableColumnDefinition_DOUBLE,
				Description: "The search score",
			},
			{
				Name:        SEARCH_FIELD_LEGACY_ID,
				Type:        resourcepb.ResourceTableColumnDefinition_INT64,
				Description: "Deprecated legacy id of the resource",
			},
			{
				Name:        SEARCH_FIELD_MANAGER_KIND,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				Description: "Type of manager, which is responsible for managing the resource",
			},
			// TODO: below fields only need to be returned from search, but do not need to be searchable
			{
				Name: SEARCH_FIELD_MANAGER_ID,
				Type: resourcepb.ResourceTableColumnDefinition_STRING,
			},
			{
				Name: SEARCH_FIELD_SOURCE_TIME,
				Type: resourcepb.ResourceTableColumnDefinition_INT64,
			},
			{
				Name: SEARCH_FIELD_SOURCE_PATH,
				Type: resourcepb.ResourceTableColumnDefinition_STRING,
			},
			{
				Name: SEARCH_FIELD_SOURCE_CHECKSUM,
				Type: resourcepb.ResourceTableColumnDefinition_STRING,
			},
			{
				Name:        SEARCH_FIELD_OWNER_REFERENCES,
				Type:        resourcepb.ResourceTableColumnDefinition_STRING,
				IsArray:     true,
				Description: "Owner references in format {Group}/{Kind}/{Name}",
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
