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

// Snapshot  allows to explicitly perform a snapshot through the gateway of one or more indices (backup them).
// By default, each index gateway periodically snapshot changes, though it can be disabled and be controlled completely through this API.
// see http://www.elasticsearch.org/guide/reference/api/admin-indices-gateway-snapshot/
func (c *Conn) Snapshot(indices ...string) (ExtendedStatus, error) {
	var retval ExtendedStatus
	var url string
	if len(indices) > 0 {
		url = fmt.Sprintf("/%s/_gateway/snapshot", strings.Join(indices, ","))

	} else {
		url = fmt.Sprintf("/_gateway/snapshot")
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
