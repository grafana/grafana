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
	"strings"
)

// Status lists status details of all indices or the specified index.
// http://www.elasticsearch.org/guide/reference/api/admin-indices-status.html
func (c *Conn) Status(args map[string]interface{}, indices ...string) (BaseResponse, error) {
	var retval BaseResponse
	var url string
	if len(indices) > 0 {
		url = fmt.Sprintf("/%s/_status", strings.Join(indices, ","))

	} else {
		url = "/_status"
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
