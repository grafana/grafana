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

// Flush flushes one or more indices through an API. The flush process of an index basically
// frees memory from the index by flushing data to the index storage and clearing the internal transaction
// log. By default, ElasticSearch uses memory heuristics in order to automatically trigger flush operations
// as required in order to clear memory.
// http://www.elasticsearch.org/guide/reference/api/admin-indices-flush.html
// TODO: add Shards to response
func (c *Conn) Flush(indices ...string) (BaseResponse, error) {
	var url string
	var retval BaseResponse
	if len(indices) > 0 {
		url = fmt.Sprintf("/%s/_flush", strings.Join(indices, ","))
	} else {
		url = "/_flush"
	}
	body, err := c.DoCommand("POST", url, nil, nil)
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
