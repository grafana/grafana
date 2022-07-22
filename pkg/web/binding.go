package web

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"reflect"
)

// Bind deserializes JSON payload from the request
func Bind(req *http.Request, v interface{}) error {
	if req.Body != nil {
		m, _, err := mime.ParseMediaType(req.Header.Get("Content-type"))
		if err != nil {
			return err
		}
		if m != "application/json" {
			return errors.New("bad content type")
		}
		defer func() { _ = req.Body.Close() }()
		err = json.NewDecoder(req.Body).Decode(v)
		if err != nil && !errors.Is(err, io.EOF) {
			return err
		}
	}
	return validate(v)
}

type Validator interface {
	Validate() error
}

func validate(obj interface{}) error {
	// First check if obj is nil, because we cannot validate those.
	if obj == nil {
		return nil
	}

	// Second, check if obj has a nil interface value.
	// This is to prevent panics when obj is an instance of uninitialised struct pointer / interface.
	t := reflect.TypeOf(obj)
	v := reflect.ValueOf(obj)

	if v.Kind() == reflect.Ptr && v.IsNil() {
		return nil
	}

	// If type has a Validate() method - use that
	if validator, ok := obj.(Validator); ok {
		return validator.Validate()
	}

	// Otherwise, use reflection to match `binding:"Required"` struct field tags.
	// Resolve all pointers and interfaces, until we get a concrete type.
	for v.Kind() == reflect.Interface || v.Kind() == reflect.Ptr {
		t = t.Elem()
		v = v.Elem()
	}
	switch v.Kind() {
	// For arrays and slices - iterate over each element and validate it recursively
	case reflect.Slice, reflect.Array:
		for i := 0; i < v.Len(); i++ {
			e := v.Index(i).Interface()
			if err := validate(e); err != nil {
				return err
			}
		}
	// For structs - iterate over each field, check for the "Required" constraint (Macaron legacy), then validate it recursively
	case reflect.Struct:
		for i := 0; i < v.NumField(); i++ {
			field := t.Field(i)
			value := v.Field(i)
			rule := field.Tag.Get("binding")
			if !value.CanInterface() {
				continue
			}
			if rule == "Required" {
				zero := reflect.Zero(field.Type).Interface()
				if value.Kind() == reflect.Slice {
					if value.Len() == 0 {
						return fmt.Errorf("required slice %s must not be empty", field.Name)
					}
				} else if reflect.DeepEqual(zero, value.Interface()) {
					return fmt.Errorf("required value %s must not be empty", field.Name)
				}
			}
			if err := validate(value.Interface()); err != nil {
				return err
			}
		}
	default: // ignore
	}
	return nil
}
