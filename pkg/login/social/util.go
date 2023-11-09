package social

import (
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/util"
	"github.com/mitchellh/mapstructure"
	"gopkg.in/ini.v1"
)

// ConvertIniSectionToMap converts key value pairs from an ini section to a map[string]interface{}
func ConvertIniSectionToMap(sec *ini.Section) map[string]interface{} {
	mappedSettings := make(map[string]interface{})
	for k, v := range sec.KeysHash() {
		mappedSettings[k] = v
	}
	return mappedSettings
}

func CreateOAuthInfoFromKeyValues(settingsKV map[string]interface{}) (*OAuthInfo, error) {
	emptyStrToSliceDecodeHook := func(from reflect.Type, to reflect.Type, data interface{}) (interface{}, error) {
		if from.Kind() == reflect.String && to.Kind() == reflect.Slice {
			strData, ok := data.(string)
			if !ok {
				return nil, fmt.Errorf("failed to convert %v to string", data)
			}
			if strData == "" {
				return []string{}, nil
			}
			return util.SplitString(strData), nil
		}
		return data, nil
	}

	var oauthInfo OAuthInfo
	decoder, err := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
		DecodeHook:       emptyStrToSliceDecodeHook,
		Result:           &oauthInfo,
		WeaklyTypedInput: true,
	})

	err = decoder.Decode(settingsKV)
	if err != nil {
		return nil, err
	}

	if oauthInfo.EmptyScopes {
		oauthInfo.Scopes = []string{}
	}

	return &oauthInfo, err
}

func constructOAuthInfoFromIniSection(sec *ini.Section) (*OAuthInfo, error) {
	settingsKV := ConvertIniSectionToMap(sec)
	return CreateOAuthInfoFromKeyValues(settingsKV)
}
