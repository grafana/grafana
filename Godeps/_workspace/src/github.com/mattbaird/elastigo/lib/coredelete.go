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

// Delete API allows to delete a typed JSON document from a specific index based on its id.
// http://www.elasticsearch.org/guide/reference/api/delete.html
func (c *Conn) Delete(index string, _type string, id string, args map[string]interface{}) (BaseResponse, error) {
	var url string
	var retval BaseResponse
	url = fmt.Sprintf("/%s/%s/%s", index, _type, id)
	body, err := c.DoCommand("DELETE", url, args, nil)
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
