// Code generated - EDITING IS FUTILE. DO NOT EDIT.
//
// Using jennies:
//     GoJSONMarshalling

package rolebinding

import (
	"encoding/json"
	"errors"
	"fmt"
)

func (resource BuiltinRoleRefOrCustomRoleRef) MarshalJSON() ([]byte, error) {
	if resource.BuiltinRoleRef != nil {
		return json.Marshal(resource.BuiltinRoleRef)
	}
	if resource.CustomRoleRef != nil {
		return json.Marshal(resource.CustomRoleRef)
	}

	return nil, nil
}

func (resource *BuiltinRoleRefOrCustomRoleRef) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]any)
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["kind"]
	if !found {
		return errors.New("discriminator field 'kind' not found in payload")
	}

	switch discriminator {
	case "BuiltinRole":
		var builtinRoleRef BuiltinRoleRef
		if err := json.Unmarshal(raw, &builtinRoleRef); err != nil {
			return err
		}

		resource.BuiltinRoleRef = &builtinRoleRef
		return nil
	case "Role":
		var customRoleRef CustomRoleRef
		if err := json.Unmarshal(raw, &customRoleRef); err != nil {
			return err
		}

		resource.CustomRoleRef = &customRoleRef
		return nil
	}

	return fmt.Errorf("could not unmarshal resource with `kind = %v`", discriminator)
}
