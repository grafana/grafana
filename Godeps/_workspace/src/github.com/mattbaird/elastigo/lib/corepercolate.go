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

// RegisterPercolate allows the caller to register queries against an index,
// and then send percolate requests which include a doc, and getting back the
// queries that match on that doc out of the set of registered queries.  Think
// of it as the reverse operation of indexing and then searching. Instead of
// sending docs, indexing them, and then running queries. One sends queries,
// registers them, and then sends docs and finds out which queries match that
// doc.
// see http://www.elasticsearch.org/guide/reference/api/percolate.html
func (c *Conn) RegisterPercolate(index string, name string, args map[string]interface{}, query OneTermQuery) (BaseResponse, error) {
	var url string
	var retval BaseResponse
	url = fmt.Sprintf("/_percolator/%s/%s", index, name)
	body, err := c.DoCommand("PUT", url, args, query)
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

func (c *Conn) Percolate(index string, _type string, name string, args map[string]interface{}, doc string) (Match, error) {
	var url string
	var retval Match
	url = fmt.Sprintf("/%s/%s/_percolate", index, _type)
	body, err := c.DoCommand("GET", url, args, doc)
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
