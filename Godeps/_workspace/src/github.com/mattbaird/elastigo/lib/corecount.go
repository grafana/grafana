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

type CountResponse struct {
	Count int    `json:"count"`
	Shard Status `json:"_shards"`
}

// Count allows the caller to easily execute a query and get the number of matches for that query.
// It can be executed across one or more indices and across one or more types.
// The query can either be provided using a simple query string as a parameter,
// or using the Query DSL defined within the request body.
// http://www.elasticsearch.org/guide/reference/api/count.html
func (c *Conn) Count(index string, _type string, args map[string]interface{}, query interface{}) (CountResponse, error) {
	var url string
	var retval CountResponse
	url = fmt.Sprintf("/%s/%s/_count", index, _type)
	body, err := c.DoCommand("GET", url, args, query)
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
