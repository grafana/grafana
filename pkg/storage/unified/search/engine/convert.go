package engine

import (
	"fmt"
	"strings"

	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// IndexKey converts a ResourceIndexKey to NamespacedResource.
func IndexKey(key *resourcepb.ResourceIndexKey) resource.NamespacedResource {
	if key == nil {
		return resource.NamespacedResource{}
	}
	return resource.NamespacedResource{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}
}

// ToIndexKey converts NamespacedResource to ResourceIndexKey.
func ToIndexKey(key resource.NamespacedResource) *resourcepb.ResourceIndexKey {
	return &resourcepb.ResourceIndexKey{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}
}

func FieldDescriptorToSearchField(def *resourcepb.FieldDescriptor) resource.SearchFieldDefinition {
	if def == nil {
		return resource.SearchFieldDefinition{}
	}
	return resource.SearchFieldDefinition{
		Name:         def.Name,
		Type:         fieldTypeFromProto(def.Type),
		Array:        def.Array,
		Capabilities: capabilitiesFromProto(def.Capabilities),
	}
}

func FieldDescriptorsToSearchFields(schema []*resourcepb.FieldDescriptor) []resource.SearchFieldDefinition {
	out := make([]resource.SearchFieldDefinition, 0, len(schema))
	for _, def := range schema {
		if def == nil {
			continue
		}
		out = append(out, FieldDescriptorToSearchField(def))
	}
	return out
}

func SearchFieldToDescriptor(def resource.SearchFieldDefinition) *resourcepb.FieldDescriptor {
	return &resourcepb.FieldDescriptor{
		Name:         def.Name,
		Type:         fieldTypeToProto(def.Type),
		Array:        def.Array,
		Capabilities: capabilitiesToProto(def.Capabilities),
	}
}

func SearchableFieldsFromSchema(schema []*resourcepb.FieldDescriptor) (resource.SearchableDocumentFields, error) {
	cols := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(schema))
	for _, def := range schema {
		if def == nil {
			continue
		}
		cols = append(cols, fieldDescriptorToColumn(def))
	}
	return resource.NewSearchableDocumentFields(cols)
}

func fieldDescriptorToColumn(def *resourcepb.FieldDescriptor) *resourcepb.ResourceTableColumnDefinition {
	sf := FieldDescriptorToSearchField(def)
	col := &resourcepb.ResourceTableColumnDefinition{
		Name:        sf.Name,
		Type:        columnTypeFromSearchField(sf.Type),
		IsArray:     sf.Array,
		Description: sf.Description,
		Properties:  &resourcepb.ResourceTableColumnDefinition_Properties{},
	}
	for _, c := range sf.Capabilities {
		switch c {
		case resource.SearchCapabilityFilter:
			col.Properties.Filterable = true
		case resource.SearchCapabilityText:
			col.Properties.FreeText = true
		}
	}
	return col
}

func DocumentToIndexable(doc *resourcepb.Document) (*resource.IndexableDocument, error) {
	if doc == nil || doc.Key == nil {
		return nil, fmt.Errorf("document key is required")
	}
	fields, err := fieldValuesToMap(doc.Fields)
	if err != nil {
		return nil, err
	}
	return &resource.IndexableDocument{
		Key:             doc.Key,
		RV:              doc.ResourceVersion,
		Name:            doc.Key.Name,
		Title:           doc.Title,
		Folder:          doc.Folder,
		Created:         doc.Created,
		CreatedBy:       doc.CreatedBy,
		OwnerReferences: doc.OwnerReferences,
		Labels:          doc.Labels,
		Fields:          fields,
	}, nil
}

func IndexableToDocument(doc *resource.IndexableDocument) (*resourcepb.Document, error) {
	if doc == nil || doc.Key == nil {
		return nil, fmt.Errorf("document key is required")
	}
	fieldValues, err := mapToFieldValues(doc.Fields)
	if err != nil {
		return nil, err
	}
	return &resourcepb.Document{
		Key:             doc.Key,
		ResourceVersion: doc.RV,
		Title:           doc.Title,
		Folder:          doc.Folder,
		Created:         doc.Created,
		CreatedBy:       doc.CreatedBy,
		OwnerReferences: doc.OwnerReferences,
		Labels:          doc.Labels,
		Fields:          fieldValues,
	}, nil
}

func fieldValuesToMap(values []*resourcepb.FieldValue) (map[string]any, error) {
	if len(values) == 0 {
		return nil, nil
	}
	out := make(map[string]any, len(values))
	for _, fv := range values {
		if fv == nil {
			continue
		}
		v, err := protoValuesToAny(fv.Values, len(fv.Values) > 1)
		if err != nil {
			return nil, fmt.Errorf("field %q: %w", fv.Name, err)
		}
		out[fv.Name] = v
	}
	return out, nil
}

func mapToFieldValues(fields map[string]any) ([]*resourcepb.FieldValue, error) {
	if len(fields) == 0 {
		return nil, nil
	}
	out := make([]*resourcepb.FieldValue, 0, len(fields))
	for name, raw := range fields {
		values, err := anyToProtoValues(raw)
		if err != nil {
			return nil, fmt.Errorf("field %q: %w", name, err)
		}
		out = append(out, &resourcepb.FieldValue{Name: name, Values: values})
	}
	return out, nil
}

func protoValuesToAny(values []*structpb.Value, forceArray bool) (any, error) {
	if len(values) == 0 {
		return nil, nil
	}
	if !forceArray && len(values) == 1 {
		return structValueToAny(values[0])
	}
	arr := make([]any, 0, len(values))
	for _, v := range values {
		x, err := structValueToAny(v)
		if err != nil {
			return nil, err
		}
		arr = append(arr, x)
	}
	return arr, nil
}

func structValueToAny(v *structpb.Value) (any, error) {
	if v == nil {
		return nil, nil
	}
	switch kind := v.Kind.(type) {
	case *structpb.Value_NullValue:
		return nil, nil
	case *structpb.Value_StringValue:
		return kind.StringValue, nil
	case *structpb.Value_NumberValue:
		return kind.NumberValue, nil
	case *structpb.Value_BoolValue:
		return kind.BoolValue, nil
	case *structpb.Value_ListValue:
		arr := make([]any, 0, len(kind.ListValue.Values))
		for _, item := range kind.ListValue.Values {
			x, err := structValueToAny(item)
			if err != nil {
				return nil, err
			}
			arr = append(arr, x)
		}
		return arr, nil
	default:
		return nil, fmt.Errorf("unsupported value kind %T", kind)
	}
}

func anyToProtoValues(raw any) ([]*structpb.Value, error) {
	switch v := raw.(type) {
	case nil:
		return nil, nil
	case []string:
		out := make([]*structpb.Value, 0, len(v))
		for _, s := range v {
			out = append(out, structpb.NewStringValue(s))
		}
		return out, nil
	case []any:
		out := make([]*structpb.Value, 0, len(v))
		for _, item := range v {
			pv, err := structpb.NewValue(item)
			if err != nil {
				return nil, err
			}
			out = append(out, pv)
		}
		return out, nil
	default:
		pv, err := structpb.NewValue(v)
		if err != nil {
			return nil, err
		}
		return []*structpb.Value{pv}, nil
	}
}

func fieldTypeFromProto(t resourcepb.FieldType) resource.SearchFieldType {
	switch t {
	case resourcepb.FieldType_FIELD_TYPE_STRING:
		return resource.SearchFieldTypeString
	case resourcepb.FieldType_FIELD_TYPE_INT64:
		return resource.SearchFieldTypeInt64
	case resourcepb.FieldType_FIELD_TYPE_DOUBLE:
		return resource.SearchFieldTypeDouble
	case resourcepb.FieldType_FIELD_TYPE_BOOLEAN:
		return resource.SearchFieldTypeBoolean
	case resourcepb.FieldType_FIELD_TYPE_DATE:
		return resource.SearchFieldTypeDate
	default:
		return resource.SearchFieldTypeUnknown
	}
}

func fieldTypeToProto(t resource.SearchFieldType) resourcepb.FieldType {
	switch t {
	case resource.SearchFieldTypeString:
		return resourcepb.FieldType_FIELD_TYPE_STRING
	case resource.SearchFieldTypeInt64:
		return resourcepb.FieldType_FIELD_TYPE_INT64
	case resource.SearchFieldTypeDouble:
		return resourcepb.FieldType_FIELD_TYPE_DOUBLE
	case resource.SearchFieldTypeBoolean:
		return resourcepb.FieldType_FIELD_TYPE_BOOLEAN
	case resource.SearchFieldTypeDate:
		return resourcepb.FieldType_FIELD_TYPE_DATE
	default:
		return resourcepb.FieldType_FIELD_TYPE_UNSPECIFIED
	}
}

func columnTypeFromSearchField(t resource.SearchFieldType) resourcepb.ResourceTableColumnDefinition_ColumnType {
	switch t {
	case resource.SearchFieldTypeString:
		return resourcepb.ResourceTableColumnDefinition_STRING
	case resource.SearchFieldTypeInt64:
		return resourcepb.ResourceTableColumnDefinition_INT64
	case resource.SearchFieldTypeDouble:
		return resourcepb.ResourceTableColumnDefinition_DOUBLE
	case resource.SearchFieldTypeBoolean:
		return resourcepb.ResourceTableColumnDefinition_BOOLEAN
	case resource.SearchFieldTypeDate:
		return resourcepb.ResourceTableColumnDefinition_DATE
	default:
		return resourcepb.ResourceTableColumnDefinition_UNKNOWN_TYPE
	}
}

func capabilitiesFromProto(caps []resourcepb.Capability) []resource.SearchCapability {
	out := make([]resource.SearchCapability, 0, len(caps))
	for _, c := range caps {
		switch c {
		case resourcepb.Capability_CAPABILITY_FILTER:
			out = append(out, resource.SearchCapabilityFilter)
		case resourcepb.Capability_CAPABILITY_TEXT:
			out = append(out, resource.SearchCapabilityText)
		case resourcepb.Capability_CAPABILITY_PARTIAL:
			out = append(out, resource.SearchCapabilityPartial)
		case resourcepb.Capability_CAPABILITY_SORT:
			out = append(out, resource.SearchCapabilitySort)
		case resourcepb.Capability_CAPABILITY_FACET:
			out = append(out, resource.SearchCapabilityFacet)
		case resourcepb.Capability_CAPABILITY_RETRIEVE:
			out = append(out, resource.SearchCapabilityRetrieve)
		case resourcepb.Capability_CAPABILITY_UNRANKED:
			out = append(out, resource.SearchCapabilityUnranked)
		}
	}
	return out
}

func capabilitiesToProto(caps []resource.SearchCapability) []resourcepb.Capability {
	out := make([]resourcepb.Capability, 0, len(caps))
	for _, c := range caps {
		switch c {
		case resource.SearchCapabilityFilter:
			out = append(out, resourcepb.Capability_CAPABILITY_FILTER)
		case resource.SearchCapabilityText:
			out = append(out, resourcepb.Capability_CAPABILITY_TEXT)
		case resource.SearchCapabilityPartial:
			out = append(out, resourcepb.Capability_CAPABILITY_PARTIAL)
		case resource.SearchCapabilitySort:
			out = append(out, resourcepb.Capability_CAPABILITY_SORT)
		case resource.SearchCapabilityFacet:
			out = append(out, resourcepb.Capability_CAPABILITY_FACET)
		case resource.SearchCapabilityRetrieve:
			out = append(out, resourcepb.Capability_CAPABILITY_RETRIEVE)
		case resource.SearchCapabilityUnranked:
			out = append(out, resourcepb.Capability_CAPABILITY_UNRANKED)
		}
	}
	return out
}

// ResolveFieldName maps a public field name to the internal bleve field path.
func ResolveFieldName(name string) string {
	if name == "" {
		return name
	}
	if strings.HasPrefix(name, resource.SEARCH_FIELD_PREFIX) ||
		strings.HasPrefix(name, resource.SEARCH_SELECTABLE_FIELDS_PREFIX) {
		return name
	}
	switch name {
	case resource.SEARCH_FIELD_TITLE, resource.SEARCH_FIELD_NAME, resource.SEARCH_FIELD_FOLDER,
		resource.SEARCH_FIELD_TAGS, resource.SEARCH_FIELD_CREATED_BY, resource.SEARCH_FIELD_OWNER_REFERENCES:
		return name
	default:
		return resource.SEARCH_FIELD_PREFIX + name
	}
}
