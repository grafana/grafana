package macaron

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"
)

// Bind deserializes JSON payload from the request
func Bind(req *http.Request, v interface{}) error {
	if req.Body != nil {
		defer req.Body.Close()
		err := json.NewDecoder(req.Body).Decode(v)
		if err != nil && err != io.EOF {
			return err
		}
	}
	return validate(v)
}

type Validator interface {
	Validate() error
}

func validate(obj interface{}) error {
	// If type has a Validate() method - use that
	if validator, ok := obj.(Validator); ok {
		return validator.Validate()
	}
	// Otherwise, use relfection to match `binding:"Required"` struct field tags.
	// Resolve all pointers and interfaces, until we get a concrete type.
	t := reflect.TypeOf(obj)
	v := reflect.ValueOf(obj)
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
	}
	return nil
}
