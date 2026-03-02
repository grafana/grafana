package models

import (
	"encoding/json"
)

// InstanceAnnotations is an extension to map[string]string with methods
// for database serialization.
type InstanceAnnotations map[string]string

// FromDB loads annotations stored in the database as JSON into InstanceAnnotations.
// FromDB is part of the xorm Conversion interface.
func (a *InstanceAnnotations) FromDB(b []byte) error {
	if len(b) == 0 {
		*a = nil
		return nil
	}
	annotations := make(map[string]string)
	err := json.Unmarshal(b, &annotations)
	if err != nil {
		return err
	}
	*a = annotations
	return nil
}

// ToDB serializes InstanceAnnotations to JSON for database storage.
// ToDB is part of the xorm Conversion interface.
func (a *InstanceAnnotations) ToDB() ([]byte, error) {
	if a == nil || len(*a) == 0 {
		return nil, nil
	}
	return json.Marshal(*a)
}
