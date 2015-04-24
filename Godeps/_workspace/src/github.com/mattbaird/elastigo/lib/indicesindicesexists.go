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
	"fmt"
	"strings"
)

// IndicesExists checks for the existance of indices. uses RecordNotFound message if it doesn't exist and
// "no error" situation if it exists. If there is some other error, gives the error and says it exists
// just in case
// see http://www.elasticsearch.org/guide/reference/api/admin-indices-indices-exists/
func (c *Conn) IndicesExists(indices ...string) (bool, error) {
	var url string
	if len(indices) > 0 {
		url = fmt.Sprintf("/%s", strings.Join(indices, ","))
	}
	_, err := c.DoCommand("HEAD", url, nil, nil)
	if err != nil {
		if err == RecordNotFound {
			return false, nil
		} else {
			return true, err
		}
	}
	return true, nil
}
