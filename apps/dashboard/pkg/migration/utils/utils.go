package utils

func IsArray(value interface{}) bool {
	if value == nil {
		return false
	}
	_, ok := value.([]interface{})
	return ok
}
