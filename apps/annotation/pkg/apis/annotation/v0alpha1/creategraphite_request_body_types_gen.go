// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
	errors "errors"
)

// Annotation event in the Graphite events format.
type CreateGraphiteRequestBody struct {
	// Title of the event. Becomes the first line of the annotation text.
	What string `json:"what"`
	// Time of the event, in Unix seconds. Defaults to the current time.
	When *int64 `json:"when,omitempty"`
	// Additional event details, appended to the annotation text on a new line.
	Data *string `json:"data,omitempty"`
	// Tags of the event, as an array of strings or a single space-separated string.
	Tags CreateGraphiteRequestStringOrArrayOfString `json:"tags"`
}

// NewCreateGraphiteRequestBody creates a new CreateGraphiteRequestBody object.
func NewCreateGraphiteRequestBody() *CreateGraphiteRequestBody {
	return &CreateGraphiteRequestBody{
		Tags: *NewCreateGraphiteRequestStringOrArrayOfString(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for CreateGraphiteRequestBody.
func (CreateGraphiteRequestBody) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.CreateGraphiteRequestBody"
}

type CreateGraphiteRequestStringOrArrayOfString struct {
	String        *string  `json:"String,omitempty"`
	ArrayOfString []string `json:"ArrayOfString,omitempty"`
}

// NewCreateGraphiteRequestStringOrArrayOfString creates a new CreateGraphiteRequestStringOrArrayOfString object.
func NewCreateGraphiteRequestStringOrArrayOfString() *CreateGraphiteRequestStringOrArrayOfString {
	return &CreateGraphiteRequestStringOrArrayOfString{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `CreateGraphiteRequestStringOrArrayOfString` as JSON.
func (resource CreateGraphiteRequestStringOrArrayOfString) MarshalJSON() ([]byte, error) {
	if resource.String != nil {
		return json.Marshal(resource.String)
	}

	if resource.ArrayOfString != nil {
		return json.Marshal(resource.ArrayOfString)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `CreateGraphiteRequestStringOrArrayOfString` from JSON.
func (resource *CreateGraphiteRequestStringOrArrayOfString) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	var errList []error

	// String
	var String string
	if err := json.Unmarshal(raw, &String); err != nil {
		errList = append(errList, err)
		resource.String = nil
	} else {
		resource.String = &String
		return nil
	}

	// ArrayOfString
	var ArrayOfString []string
	if err := json.Unmarshal(raw, &ArrayOfString); err != nil {
		errList = append(errList, err)
		resource.ArrayOfString = nil
	} else {
		resource.ArrayOfString = ArrayOfString
		return nil
	}

	return errors.Join(errList...)
}

// OpenAPIModelName returns the OpenAPI model name for CreateGraphiteRequestStringOrArrayOfString.
func (CreateGraphiteRequestStringOrArrayOfString) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.annotation.pkg.apis.annotation.v0alpha1.CreateGraphiteRequestStringOrArrayOfString"
}
