package util

import (
	"encoding/json"

	"github.com/jmespath-community/go-jmespath"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

// DynMap defines a dynamic map interface.
type DynMap map[string]any

var (
	// ErrEmptyJSON is an error for empty attribute in JSON.
	ErrEmptyJSON = errutil.NewBase(errutil.StatusBadRequest,
		"json-missing-body", errutil.WithPublicMessage("Empty JSON provided"))

	// ErrNoAttributePathSpecified is an error for no attribute path specified.
	ErrNoAttributePathSpecified = errutil.NewBase(errutil.StatusBadRequest,
		"json-no-attribute-path-specified", errutil.WithPublicMessage("No attribute path specified"))

	// ErrFailedToUnmarshalJSON is an error for failure in unmarshalling JSON.
	ErrFailedToUnmarshalJSON = errutil.NewBase(errutil.StatusBadRequest,
		"json-failed-to-unmarshal", errutil.WithPublicMessage("Failed to unmarshal JSON"))

	// ErrFailedToSearchJSON is an error for failure in searching JSON.
	ErrFailedToSearchJSON = errutil.NewBase(errutil.StatusBadRequest,
		"json-failed-to-search", errutil.WithPublicMessage("Failed to search JSON with provided path"))
)

// SearchJSONForStringSliceAttr searches for a slice attribute in a JSON object and returns a string slice.
// The attributePath parameter is a string that specifies the path to the attribute.
// The data parameter is the JSON object that we're searching. It can be a byte slice or a go type.
func SearchJSONForStringSliceAttr(attributePath string, data any) ([]string, error) {
	val, err := searchJSONForAttr(attributePath, data)
	if err != nil {
		return []string{}, err
	}

	ifArr, ok := val.([]any)
	if !ok {
		return []string{}, nil
	}

	result := []string{}
	for _, v := range ifArr {
		if strVal, ok := v.(string); ok {
			result = append(result, strVal)
		}
	}

	return result, nil
}

// SearchJSONForStringAttr searches for a specific attribute in a JSON object and returns a string.
// The attributePath parameter is a string that specifies the path to the attribute.
// The data parameter is the JSON object that we're searching. It can be a byte slice or a go type.
func SearchJSONForStringAttr(attributePath string, data any) (string, error) {
	val, err := searchJSONForAttr(attributePath, data)
	if err != nil {
		return "", err
	}

	strVal, ok := val.(string)
	if ok {
		return strVal, nil
	}

	return "", nil
}

// searchJSONForAttr searches for a specific attribute in a JSON object.
// The attributePath parameter is a string that specifies the path to the attribute.
// The data parameter is the JSON object that we're searching.
// The function returns the value of the attribute and an error if one occurred.
func searchJSONForAttr(attributePath string, data any) (any, error) {
	// If no attribute path is specified, return an error
	if attributePath == "" {
		return "", ErrNoAttributePathSpecified.Errorf("attribute path: %q", attributePath)
	}

	// If the data is nil, return an error
	if data == nil {
		return "", ErrEmptyJSON.Errorf("empty json, attribute path: %q", attributePath)
	}

	// Copy the data to a new variable
	jsonData := data

	// If the data is a byte slice, try to unmarshal it into a JSON object
	if dataBytes, ok := data.([]byte); ok {
		// If the byte slice is empty, return an error
		if len(dataBytes) == 0 {
			return "", ErrEmptyJSON.Errorf("empty json, attribute path: %q", attributePath)
		}

		// Try to unmarshal the byte slice
		if err := json.Unmarshal(dataBytes, &jsonData); err != nil {
			return "", ErrFailedToUnmarshalJSON.Errorf("%v: %w", "failed to unmarshal user info JSON response", err)
		}
	}

	// Search for the attribute in the JSON object
	value, err := jmespath.Search(attributePath, jsonData)
	if err != nil {
		return "", ErrFailedToSearchJSON.Errorf("failed to search user info JSON response with provided path: %q: %w", attributePath, err)
	}

	// Return the value and nil error
	return value, nil
}
