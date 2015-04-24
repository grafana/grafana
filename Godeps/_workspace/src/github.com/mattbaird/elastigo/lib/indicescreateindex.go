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
)

// The create API allows you to create an indices through an API.
func (c *Conn) CreateIndex(index string) (BaseResponse, error) {
	var url string
	var retval BaseResponse

	if len(index) > 0 {
		url = fmt.Sprintf("/%s", index)
	} else {
		return retval, fmt.Errorf("You must specify an index to create")
	}

	body, err := c.DoCommand("PUT", url, nil, nil)
	if err != nil {
		return retval, err
	}

	jsonErr := json.Unmarshal(body, &retval)
	if jsonErr != nil {
		return retval, jsonErr
	}

	return retval, err
}

// The create API allows you to create an indices through an API.
func (c *Conn) CreateIndexWithSettings(index string, settings interface{}) (BaseResponse, error) {
	var url string
	var retval BaseResponse

	settingsType := reflect.TypeOf(settings)
	if settingsType.Kind() != reflect.Struct {
		return retval, fmt.Errorf("Settings kind was not struct")
	}

	requestBody, err := json.Marshal(settings)

	if err != nil {
		return retval, err
	}

	if len(index) > 0 {
		url = fmt.Sprintf("/%s", index)
	} else {
		return retval, fmt.Errorf("You must specify an index to create")
	}

	body, err := c.DoCommand("PUT", url, nil, requestBody)
	if err != nil {
		return retval, err
	}

	jsonErr := json.Unmarshal(body, &retval)
	if jsonErr != nil {
		return retval, jsonErr
	}

	return retval, err
}
