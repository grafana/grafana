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
)

// Validate allows a user to validate a potentially expensive query without executing it.
// see http://www.elasticsearch.org/guide/reference/api/validate.html
func (c *Conn) Validate(index string, _type string, args map[string]interface{}) (BaseResponse, error) {
	var url string
	var retval BaseResponse
	if len(_type) > 0 {
		url = fmt.Sprintf("/%s/%s/_validate/", index, _type)
	} else {
		url = fmt.Sprintf("/%s/_validate/", index)
	}
	body, err := c.DoCommand("GET", url, args, nil)
	if err != nil {
		return retval, err
	}
	if err == nil {
		// marshall into json
		jsonErr := json.Unmarshal(body, &retval)
		if jsonErr != nil {
			return retval, jsonErr
		}
	}
	return retval, err
}

type Validation struct {
	Valid         bool           `json:"valid"`
	Shards        Status         `json:"_shards"`
	Explainations []Explaination `json:"explanations,omitempty"`
}

type Explaination struct {
	Index string `json:"index"`
	Valid bool   `json:"valid"`
	Error string `json:"error"`
}
