package models

var (
	ExtractFieldCaseInsensitiveForTest = extractFieldCaseInsensitive
	JsonifyValuesForTest               = jsonifyValues
	SetFieldForTest                    = setField
	UnjsonifyValuesForTest             = unjsonifyValues
)

func WithModelPropsForTest(query AlertQuery, props map[string]any) AlertQuery {
	query.modelProps = props
	return query
}
