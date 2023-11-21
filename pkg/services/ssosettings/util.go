package ssosettings

import "github.com/grafana/grafana/pkg/services/featuremgmt/strcase"

func ConvertMapSnakeCaseKeysToCamelCaseKeys(m map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range m {
		result[strcase.ToLowerCamel(k)] = v
	}
	return result
}

func ConvertMapCamelCaseKeysToSnakeCaseKeys(m map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range m {
		result[strcase.ToSnake(k)] = v
	}
	return result
}
