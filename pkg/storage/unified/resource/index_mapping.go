package resource

import (
	"strings"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/mapping"
	"github.com/blevesearch/bleve/v2/search"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

type IndexedResource struct {
	Uid       string
	Group     string
	Namespace string
	Kind      string
	Name      string
	Title     string
	CreatedAt string
	CreatedBy string
	UpdatedAt string
	UpdatedBy string
	FolderId  string
	Spec      any
}

func (ir IndexedResource) FromSearchHit(hit *search.DocumentMatch) IndexedResource {
	ir.Uid = hit.Fields["Uid"].(string)
	ir.Kind = hit.Fields["Kind"].(string)
	ir.Name = hit.Fields["Name"].(string)
	ir.Namespace = hit.Fields["Namespace"].(string)
	ir.Group = hit.Fields["Group"].(string)
	ir.CreatedAt = hit.Fields["CreatedAt"].(string)
	ir.CreatedBy = hit.Fields["CreatedBy"].(string)
	ir.UpdatedAt = hit.Fields["UpdatedAt"].(string)
	ir.UpdatedBy = hit.Fields["UpdatedBy"].(string)
	ir.Title = hit.Fields["Title"].(string)

	// add indexed spec fields to search results
	specResult := map[string]any{}
	for k, v := range hit.Fields {
		if strings.HasPrefix(k, "Spec.") {
			specKey := strings.TrimPrefix(k, "Spec.")
			specResult[specKey] = v
		}
		ir.Spec = specResult
	}

	return ir
}

// NewIndexedResource creates a new IndexedResource from a raw resource.
// rawResource is the raw json for the resource from unified storage.
func NewIndexedResource(rawResource []byte) (*IndexedResource, error) {
	k8sObj := unstructured.Unstructured{}
	err := k8sObj.UnmarshalJSON(rawResource)
	if err != nil {
		return nil, err
	}

	meta, err := utils.MetaAccessor(&k8sObj)
	if err != nil {
		return nil, err
	}

	ir := &IndexedResource{}
	ir.Uid = string(meta.GetUID())
	ir.Name = meta.GetName()
	ir.Title = meta.FindTitle("")
	ir.Namespace = meta.GetNamespace()
	ir.Group = meta.GetGroupVersionKind().Group
	ir.Kind = meta.GetGroupVersionKind().Kind
	ir.CreatedAt = meta.GetCreationTimestamp().Time.Format("2006-01-02T15:04:05Z")
	ir.CreatedBy = meta.GetCreatedBy()
	updatedAt, err := meta.GetUpdatedTimestamp()
	if err != nil {
		return nil, err
	}
	if updatedAt != nil {
		ir.UpdatedAt = updatedAt.Format("2006-01-02T15:04:05Z")
	} else {
		ir.UpdatedAt = ir.CreatedAt
	}
	ir.UpdatedBy = meta.GetUpdatedBy()
	spec, err := meta.GetSpec()
	if err != nil {
		return nil, err
	}
	ir.Spec = spec

	return ir, nil
}

func createIndexMappings() *mapping.IndexMappingImpl {
	// Create the index mapping
	indexMapping := bleve.NewIndexMapping()
	// Create an individual index mapping for each kind
	indexMapping.TypeField = "Kind"

	// for all kinds, create their index mappings
	for k := range getSpecObjectMappings() {
		objMapping := createIndexMappingForKind(k)
		indexMapping.AddDocumentMapping(k, objMapping)
	}

	return indexMapping
}

func createIndexMappingForKind(resourceKind string) *mapping.DocumentMapping {
	// create mappings for top level fields
	baseFields := map[string]*mapping.FieldMapping{
		"Uid":       bleve.NewTextFieldMapping(),
		"Group":     bleve.NewTextFieldMapping(),
		"Namespace": bleve.NewTextFieldMapping(),
		"Kind":      bleve.NewTextFieldMapping(),
		"Name":      bleve.NewTextFieldMapping(),
		"Title":     bleve.NewTextFieldMapping(),
		"CreatedAt": bleve.NewDateTimeFieldMapping(),
		"CreatedBy": bleve.NewTextFieldMapping(),
		"UpdatedAt": bleve.NewDateTimeFieldMapping(),
		"UpdatedBy": bleve.NewTextFieldMapping(),
		"FolderId":  bleve.NewTextFieldMapping(),
	}

	// Spec is different for all resources, so we need to generate the spec mapping based on the kind
	specMapping := createSpecObjectMapping(resourceKind)

	objectMapping := bleve.NewDocumentMapping()
	objectMapping.Dynamic = false // only map fields that we have explicitly defined

	// map spec
	objectMapping.AddSubDocumentMapping("Spec", specMapping)

	// map top level fields
	for k, v := range baseFields {
		objectMapping.AddFieldMappingsAt(k, v)
	}

	return objectMapping
}

type SpecFieldMapping struct {
	Field string
	Type  string
}

// Right now we are hardcoding which spec fields to index for each kind
// In the future, which fields to index will be defined on the resources themselves by their owners.
func getSpecObjectMappings() map[string][]SpecFieldMapping {
	mappings := map[string][]SpecFieldMapping{
		"Playlist": {
			{
				Field: "interval",
				Type:  "string",
			},
			{
				Field: "title",
				Type:  "string",
			},
		},
		"Folder": {
			{
				Field: "title",
				Type:  "string",
			},
			{
				Field: "description",
				Type:  "string",
			},
		},
		"Dashboard": {
			{
				Field: "title",
				Type:  "string",
			},
			{
				Field: "description",
				Type:  "string",
			},
		},
	}

	return mappings
}

// Generate the spec field mapping for a given kind
func createSpecObjectMapping(kind string) *mapping.DocumentMapping {
	specMapping := bleve.NewDocumentMapping()
	specMapping.Dynamic = false

	// get the fields to index for the kind
	mappings := getSpecObjectMappings()[kind]

	for _, m := range mappings {
		fieldName := m.Field
		fieldType := m.Type

		// Create a field mapping based on field type
		switch fieldType {
		case "string":
			specMapping.AddFieldMappingsAt(fieldName, bleve.NewTextFieldMapping())
		case "int", "int64", "float64":
			specMapping.AddFieldMappingsAt(fieldName, bleve.NewNumericFieldMapping())
		case "bool":
			specMapping.AddFieldMappingsAt(fieldName, bleve.NewBooleanFieldMapping())
		case "time":
			specMapping.AddFieldMappingsAt(fieldName, bleve.NewDateTimeFieldMapping())
		default:
			// TODO support indexing arrays and nested fields
			// We are only indexing top level string,int, and bool fields within spec for now. Arrays or nested fields are not yet supported.
		}
	}

	return specMapping
}
