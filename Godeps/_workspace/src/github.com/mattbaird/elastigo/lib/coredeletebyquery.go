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

// DeleteByQuery allows the caller to delete documents from one or more indices and one or more types based on a query.
// The query can either be provided using a simple query string as a parameter, or using the Query DSL defined within
// the request body.
// see: http://www.elasticsearch.org/guide/reference/api/delete-by-query.html
func (c *Conn) DeleteByQuery(indices []string, types []string, args map[string]interface{}, query interface{}) (BaseResponse, error) {
	var url string
	var retval BaseResponse
	if len(indices) > 0 && len(types) > 0 {
		url = fmt.Sprintf("/%s/%s/_query", strings.Join(indices, ","), strings.Join(types, ","))
	} else if len(indices) > 0 {
		url = fmt.Sprintf("/%s/_query", strings.Join(indices, ","))
	}
	body, err := c.DoCommand("DELETE", url, args, query)
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

func buildQuery() string {
	return ""
}

type DeleteByQueryResponse struct {
	Status   bool                   `json:"ok"`
	Indicies map[string]IndexStatus `json:"_indices"`
}

type IndexStatus struct {
	Shards Status `json:"_shards"`
}
