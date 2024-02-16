// Code generated - EDITING IS FUTILE. DO NOT EDIT.
//
// Using jennies:
//     GoJSONMarshalling

package dashboard

import (
	"encoding/json"
	"errors"
	"fmt"

	cog "github.com/grafana/grafana/pkg/kinds/cog"
)

func (resource *Panel) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}
	fields := make(map[string]json.RawMessage)
	if err := json.Unmarshal(raw, &fields); err != nil {
		return err
	}

	if fields["type"] != nil {
		if err := json.Unmarshal(fields["type"], &resource.Type); err != nil {
			return err
		}
	}

	if fields["id"] != nil {
		if err := json.Unmarshal(fields["id"], &resource.Id); err != nil {
			return err
		}
	}

	if fields["pluginVersion"] != nil {
		if err := json.Unmarshal(fields["pluginVersion"], &resource.PluginVersion); err != nil {
			return err
		}
	}

	if fields["title"] != nil {
		if err := json.Unmarshal(fields["title"], &resource.Title); err != nil {
			return err
		}
	}

	if fields["description"] != nil {
		if err := json.Unmarshal(fields["description"], &resource.Description); err != nil {
			return err
		}
	}

	if fields["transparent"] != nil {
		if err := json.Unmarshal(fields["transparent"], &resource.Transparent); err != nil {
			return err
		}
	}

	if fields["datasource"] != nil {
		if err := json.Unmarshal(fields["datasource"], &resource.Datasource); err != nil {
			return err
		}
	}

	if fields["gridPos"] != nil {
		if err := json.Unmarshal(fields["gridPos"], &resource.GridPos); err != nil {
			return err
		}
	}

	if fields["links"] != nil {
		if err := json.Unmarshal(fields["links"], &resource.Links); err != nil {
			return err
		}
	}

	if fields["repeat"] != nil {
		if err := json.Unmarshal(fields["repeat"], &resource.Repeat); err != nil {
			return err
		}
	}

	if fields["repeatDirection"] != nil {
		if err := json.Unmarshal(fields["repeatDirection"], &resource.RepeatDirection); err != nil {
			return err
		}
	}

	if fields["maxPerRow"] != nil {
		if err := json.Unmarshal(fields["maxPerRow"], &resource.MaxPerRow); err != nil {
			return err
		}
	}

	if fields["maxDataPoints"] != nil {
		if err := json.Unmarshal(fields["maxDataPoints"], &resource.MaxDataPoints); err != nil {
			return err
		}
	}

	if fields["transformations"] != nil {
		if err := json.Unmarshal(fields["transformations"], &resource.Transformations); err != nil {
			return err
		}
	}

	if fields["interval"] != nil {
		if err := json.Unmarshal(fields["interval"], &resource.Interval); err != nil {
			return err
		}
	}

	if fields["timeFrom"] != nil {
		if err := json.Unmarshal(fields["timeFrom"], &resource.TimeFrom); err != nil {
			return err
		}
	}

	if fields["timeShift"] != nil {
		if err := json.Unmarshal(fields["timeShift"], &resource.TimeShift); err != nil {
			return err
		}
	}

	if fields["hideTimeOverride"] != nil {
		if err := json.Unmarshal(fields["hideTimeOverride"], &resource.HideTimeOverride); err != nil {
			return err
		}
	}

	if fields["libraryPanel"] != nil {
		if err := json.Unmarshal(fields["libraryPanel"], &resource.LibraryPanel); err != nil {
			return err
		}
	}

	if fields["cacheTimeout"] != nil {
		if err := json.Unmarshal(fields["cacheTimeout"], &resource.CacheTimeout); err != nil {
			return err
		}
	}

	if fields["queryCachingTTL"] != nil {
		if err := json.Unmarshal(fields["queryCachingTTL"], &resource.QueryCachingTTL); err != nil {
			return err
		}
	}

	if fields["options"] != nil {
		variantCfg, found := cog.ConfigForPanelcfgVariant(resource.Type)
		if found && variantCfg.OptionsUnmarshaler != nil {
			options, err := variantCfg.OptionsUnmarshaler(fields["options"])
			if err != nil {
				return err
			}
			resource.Options = options
		} else {
			if err := json.Unmarshal(fields["options"], &resource.Options); err != nil {
				return err
			}
		}
	}

	if fields["fieldConfig"] != nil {
		variantCfg, found := cog.ConfigForPanelcfgVariant(resource.Type)
		if found && variantCfg.FieldConfigUnmarshaler != nil {
			fakeFieldConfigSource := struct {
				Defaults struct {
					Custom json.RawMessage `json:"custom"`
				} `json:"defaults"`
			}{}
			if err := json.Unmarshal(fields["fieldConfig"], &fakeFieldConfigSource); err != nil {
				return err
			}
			customFieldConfig, err := variantCfg.FieldConfigUnmarshaler(fakeFieldConfigSource.Defaults.Custom)
			if err != nil {
				return err
			}
			if err := json.Unmarshal(fields["fieldConfig"], &resource.FieldConfig); err != nil {
				return err
			}

			resource.FieldConfig.Defaults.Custom = customFieldConfig
		} else {
			if err := json.Unmarshal(fields["fieldConfig"], &resource.FieldConfig); err != nil {
				return err
			}
		}
	}

	dataqueryTypeHint := ""
	if resource.Datasource != nil && resource.Datasource.Type != nil {
		dataqueryTypeHint = *resource.Datasource.Type
	}

	targets, err := cog.UnmarshalDataqueryArray(fields["targets"], dataqueryTypeHint)
	if err != nil {
		return err
	}
	resource.Targets = targets

	return nil
}
func (resource PanelOrRowPanel) MarshalJSON() ([]byte, error) {
	if resource.Panel != nil {
		return json.Marshal(resource.Panel)
	}
	if resource.RowPanel != nil {
		return json.Marshal(resource.RowPanel)
	}

	return nil, nil
}

func (resource *PanelOrRowPanel) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]any)
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["type"]
	if !found {
		return errors.New("discriminator field 'type' not found in payload")
	}

	switch discriminator {
	default:
		var panel Panel
		if err := json.Unmarshal(raw, &panel); err != nil {
			return err
		}

		resource.Panel = &panel
		return nil
	case "row":
		var rowPanel RowPanel
		if err := json.Unmarshal(raw, &rowPanel); err != nil {
			return err
		}

		resource.RowPanel = &rowPanel
		return nil
	}

	return fmt.Errorf("could not unmarshal resource with `type = %v`", discriminator)
}

func (resource StringOrAny) MarshalJSON() ([]byte, error) {
	if resource.String != nil {
		return json.Marshal(resource.String)
	}

	if resource.Any != nil {
		return json.Marshal(resource.Any)
	}

	return nil, nil
}

func (resource *StringOrAny) UnmarshalJSON(raw []byte) error {
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

	// Any
	var Any any
	if err := json.Unmarshal(raw, &Any); err != nil {
		errList = append(errList, err)
		resource.Any = nil
	} else {
		resource.Any = &Any
		return nil
	}

	return errors.Join(errList...)
}

func (resource StringOrArrayOfString) MarshalJSON() ([]byte, error) {
	if resource.String != nil {
		return json.Marshal(resource.String)
	}

	if resource.ArrayOfString != nil {
		return json.Marshal(resource.ArrayOfString)
	}

	return nil, nil
}

func (resource *StringOrArrayOfString) UnmarshalJSON(raw []byte) error {
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

func (resource ValueMapOrRangeMapOrRegexMapOrSpecialValueMap) MarshalJSON() ([]byte, error) {
	if resource.ValueMap != nil {
		return json.Marshal(resource.ValueMap)
	}
	if resource.RangeMap != nil {
		return json.Marshal(resource.RangeMap)
	}
	if resource.RegexMap != nil {
		return json.Marshal(resource.RegexMap)
	}
	if resource.SpecialValueMap != nil {
		return json.Marshal(resource.SpecialValueMap)
	}

	return nil, nil
}

func (resource *ValueMapOrRangeMapOrRegexMapOrSpecialValueMap) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]any)
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["type"]
	if !found {
		return errors.New("discriminator field 'type' not found in payload")
	}

	switch discriminator {
	case "range":
		var rangeMap RangeMap
		if err := json.Unmarshal(raw, &rangeMap); err != nil {
			return err
		}

		resource.RangeMap = &rangeMap
		return nil
	case "regex":
		var regexMap RegexMap
		if err := json.Unmarshal(raw, &regexMap); err != nil {
			return err
		}

		resource.RegexMap = &regexMap
		return nil
	case "special":
		var specialValueMap SpecialValueMap
		if err := json.Unmarshal(raw, &specialValueMap); err != nil {
			return err
		}

		resource.SpecialValueMap = &specialValueMap
		return nil
	case "value":
		var valueMap ValueMap
		if err := json.Unmarshal(raw, &valueMap); err != nil {
			return err
		}

		resource.ValueMap = &valueMap
		return nil
	}

	return fmt.Errorf("could not unmarshal resource with `type = %v`", discriminator)
}
