package models

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/grafana/grafana/pkg/log"
	"reflect"
)

type EventDefinition struct {
	Id        string                 `json:"id"`
	EventType string                 `json:"event_type"`
	OrgId     int64                  `json:"org_id"`
	Severity  string                 `json:"severity"` // enum "INFO" "WARN" "ERROR" "OK"
	Source    string                 `json:"source"`
	Timestamp int64                  `json:"timestamp"`
	Message   string                 `json:"message"`
	Extra     map[string]interface{} `json:"-"`
}

type requiredField struct {
	StructName string
	Seen       bool
}

func (e *EventDefinition) UnmarshalJSON(raw []byte) error {
	//lets start by unmashaling into a basic map datastructure
	event := make(map[string]interface{})
	err := json.Unmarshal(raw, &event)
	if err != nil {
		return err
	}

	//lets get a list of our required fields.
	s := reflect.TypeOf(*e)
	requiredFields := make(map[string]*requiredField)

	for i := 0; i < s.NumField(); i++ {
		field := s.Field(i)
		name := field.Name
		// look at the field Tags to work out the property named used in the
		// JSON document.
		tag := field.Tag.Get("json")
		if tag != "" && tag != "-" {
			name = tag
		}
		//all fields except 'Extra' and 'Id' are required.
		if name != "Extra" && name != "id" {
			requiredFields[name] = &requiredField{
				StructName: field.Name,
				Seen:       false,
			}
		}
	}

	e.Extra = make(map[string]interface{})
	for k, v := range event {
		def, ok := requiredFields[k]
		// anything that is not a required field gets
		// stored in our 'Extra' field.
		if !ok {
			e.Extra[k] = v
		} else {
			//coerce any float64 values to int64
			if reflect.ValueOf(v).Type().Name() == "float64" {
				v = int64(v.(float64))
			}
			value := reflect.ValueOf(v)
			if value.IsValid() {
				reflect.ValueOf(e).Elem().FieldByName(def.StructName).Set(value)
			} else {
				log.Warn(fmt.Sprintf("Yikes, in eventdef %s had the zero value! %v", k, v))
			}
			def.Seen = true
		}
	}

	//make sure all required fields were present.
	for _, v := range requiredFields {
		if !v.Seen {
			return fmt.Errorf("Required field '%s' missing", v.StructName)
		}
	}
	return nil
}

func (e *EventDefinition) MarshalJSON() ([]byte, error) {
	//convert our Event object to a map[string]
	event := make(map[string]interface{})

	value := reflect.ValueOf(*e)
	for i := 0; i < value.Type().NumField(); i++ {
		field := value.Type().Field(i)
		name := field.Name
		tag := field.Tag.Get("json")
		if tag != "" && tag != "-" {
			name = tag
		}
		if name == "Extra" {
			//anything that was in Extra[] becomes a toplevel property again.
			for k, v := range e.Extra {
				event[k] = v
			}
		} else {
			v, err := encode(value.FieldByName(field.Name))
			if err != nil {
				return nil, err
			}
			event[name] = v
		}
	}
	//Marshal our map[string] into a JSON string (byte[]).
	raw, err := json.Marshal(&event)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

// convert reflect.Value object to interface{}
func encode(v reflect.Value) (interface{}, error) {
	switch v.Type().Kind() {
	case reflect.Bool:
		return v.Bool(), nil
	case reflect.String:
		return v.String(), nil
	case reflect.Int64:
		return v.Int(), nil
	case reflect.Float64:
		return v.Float(), nil
	default:
		return nil, errors.New(fmt.Sprintf("Unsupported type: %v", v.Type().Kind()))
	}
}

// ---------------------
// QUERIES

type GetEventsQuery struct {
	OrgId  int64
	Query  string `form:"query"`
	Start  int64  `form:"start"`
	End    int64  `form:"end"`
	Size   int    `form:"size"`
	Result []*EventDefinition
}
