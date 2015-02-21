package elastigo

import (
	"encoding/json"
	"fmt"
	"reflect"
)

func (c *Conn) PutSettings(index string, settings interface{}) (BaseResponse, error) {

	var url string
	var retval BaseResponse

	settingsType := reflect.TypeOf(settings)
	if settingsType.Kind() != reflect.Struct {
		return retval, fmt.Errorf("Settings kind was not struct")
	}

	if len(index) > 0 {
		url = fmt.Sprintf("/%s/_settings", index)
	} else {
		url = fmt.Sprintf("/_settings")
	}

	requestBody, err := json.Marshal(settings)

	if err != nil {
		return retval, err
	}

	body, errDo := c.DoCommand("PUT", url, nil, requestBody)
	if errDo != nil {
		return retval, errDo
	}

	jsonErr := json.Unmarshal(body, &retval)
	if jsonErr != nil {
		return retval, jsonErr
	}

	return retval, err
}
