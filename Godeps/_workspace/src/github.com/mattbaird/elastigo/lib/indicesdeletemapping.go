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

// The delete API allows you to delete a mapping through an API.
func (c *Conn) DeleteMapping(index string, typeName string) (BaseResponse, error) {
	var retval BaseResponse

	if len(index) == 0 {
		return retval, fmt.Errorf("You must specify at least one index to delete a mapping from")
	}

	if len(typeName) == 0 {
		return retval, fmt.Errorf("You must specify at least one mapping to delete")
	}

	// As documented at http://www.elasticsearch.org/guide/en/elasticsearch/reference/current/indices-delete-mapping.html
	url := fmt.Sprintf("/%s/%s", index, typeName)

	body, err := c.DoCommand("DELETE", url, nil, nil)
	if err != nil {
		return retval, err
	}

	jsonErr := json.Unmarshal(body, &retval)
	if jsonErr != nil {
		return retval, jsonErr
	}

	return retval, err
}
