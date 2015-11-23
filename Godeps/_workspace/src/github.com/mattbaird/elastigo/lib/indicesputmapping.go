// Copyright 2013 Matthew Baird
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package elastigo

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"
)

type Mapping map[string]MappingOptions

type MappingOptions struct {
	Id         IdOptions              `json:"_id"`
	Timestamp  TimestampOptions       `json:"_timestamp"`
	Analyzer   *AnalyzerOptions       `json:"_analyzer,omitempty"`
	Parent     *ParentOptions         `json:"_parent,omitempty"`
	Routing    *RoutingOptions        `json:"_routing,omitempty"`
	Size       *SizeOptions           `json:"_size,omitempty"`
	Source     *SourceOptions         `json:"_source,omitempty"`
	Type       *TypeOptions           `json:"_type,omitempty"`
	Properties map[string]interface{} `json:"properties"`
}

type TimestampOptions struct {
	Enabled bool `json:"enabled"`
}

type AnalyzerOptions struct {
	Path  string `json:"path,omitempty"`
	Index string `json:"index,omitempty"`
}

type ParentOptions struct {
	Type string `json:"type"`
}

type RoutingOptions struct {
	Required bool   `json:"required,omitempty"`
	Path     string `json:"path,omitempty"`
}

type SizeOptions struct {
	Enabled bool `json:"enabled,omitempty"`
	Store   bool `json:"store,omitempty"`
}

type SourceOptions struct {
	Enabled  bool     `json:"enabled,omitempty"`
	Includes []string `json:"includes,omitempty"`
	Excludes []string `json:"excludes,omitempty"`
}

type TypeOptions struct {
	Store bool   `json:"store,omitempty"`
	Index string `json:"index,omitempty"`
}

type IdOptions struct {
	Index string `json:"index,omitempty"`
	Path  string `json:"path,omitempty"`
}

func (m_ Mapping) Options() MappingOptions {
	m := map[string]MappingOptions(m_)
	for _, v := range m {
		return v
	}
	panic(fmt.Errorf("Malformed input: %v", m_))
}

func MappingForType(typeName string, opts MappingOptions) Mapping {
	return map[string]MappingOptions{typeName: opts}
}

func (c *Conn) PutMapping(index string, typeName string, instance interface{}, opt MappingOptions) error {
	instanceType := reflect.TypeOf(instance)
	if instanceType.Kind() != reflect.Struct {
		return fmt.Errorf("instance kind was not struct")
	}

	if opt.Properties == nil {
		opt.Properties = make(map[string]interface{})
	}
	getProperties(instanceType, opt.Properties)
	body, err := json.Marshal(MappingForType(typeName, opt))
	if err != nil {
		return err
	}
	_, err = c.DoCommand("PUT", fmt.Sprintf("/%s/%s/_mapping", index, typeName), nil, string(body))
	if err != nil {
		return err
	}

	return nil
}

func getProperties(t reflect.Type, prop map[string]interface{}) {
	n := t.NumField()
	for i := 0; i < n; i++ {
		field := t.Field(i)

		name := strings.Split(field.Tag.Get("json"), ",")[0]
		if name == "-" {
			continue
		} else if name == "" {
			name = field.Name
		}

		attrMap := make(map[string]interface{})
		attrs := splitTag(field.Tag.Get("elastic"))
		for _, attr := range attrs {
			keyvalue := strings.Split(attr, ":")
			attrMap[keyvalue[0]] = keyvalue[1]
		}

		if len(attrMap) == 0 || attrMap["type"] == "nested" {

			// We are looking for tags on any inner struct, independently of
			// whether the field is a struct, a pointer to struct, or a slice of structs
			targetType := field.Type
			if targetType.Kind() == reflect.Ptr ||
				targetType.Kind() == reflect.Slice {
				targetType = field.Type.Elem()
			}
			if targetType.Kind() == reflect.Struct {
				if field.Anonymous {
					getProperties(targetType, prop)
				} else {
					innerStructProp := make(map[string]interface{})
					getProperties(targetType, innerStructProp)
					attrMap["properties"] = innerStructProp
				}
			}
		}
		if len(attrMap) != 0 {
			prop[name] = attrMap
		}
	}
}

func splitTag(tag string) []string {
	tag = strings.Trim(tag, " ")
	if tag == "" {
		return []string{}
	} else {
		return strings.Split(tag, ",")
	}
}
