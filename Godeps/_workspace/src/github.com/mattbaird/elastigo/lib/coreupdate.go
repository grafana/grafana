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

// Update updates a document based on a script provided. The operation gets the document
// (collocated with the shard) from the index, runs the script (with optional script language and parameters),
// and index back the result (also allows to delete, or ignore the operation). It uses versioning to make sure
// no updates have happened during the “get” and “reindex”. (available from 0.19 onwards).
// Note, this operation still means full reindex of the document, it just removes some network roundtrips
// and reduces chances of version conflicts between the get and the index. The _source field need to be enabled
// for this feature to work.
//
// http://www.elasticsearch.org/guide/reference/api/update.html
// TODO: finish this, it's fairly complex
func (c *Conn) Update(index string, _type string, id string, args map[string]interface{}, data interface{}) (BaseResponse, error) {
	var url string
	var retval BaseResponse

	url = fmt.Sprintf("/%s/%s/%s/_update", index, _type, id)
	body, err := c.DoCommand("POST", url, args, data)
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

// UpdateWithPartialDoc updates a document based on partial document provided. The update API also
// support passing a partial document (since 0.20), which will be merged into the existing
// document (simple recursive merge, inner merging of objects, replacing core "keys/values" and arrays).
// If both doc and script is specified, then doc is ignored. Best is to put your field pairs of the partial
// document in the script itself.
//
// http://www.elasticsearch.org/guide/reference/api/update.html
func (c *Conn) UpdateWithPartialDoc(index string, _type string, id string, args map[string]interface{}, doc interface{}, upsert bool) (BaseResponse, error) {
	switch v := doc.(type) {
	case string:
		upsertStr := ""
		if upsert {
			upsertStr = ", \"doc_as_upsert\":true"
		}
		content := fmt.Sprintf("{\"doc\":%s %s}", v, upsertStr)
		return c.Update(index, _type, id, args, content)
	}
	var data map[string]interface{} = make(map[string]interface{})
	data["doc"] = doc
	if upsert {
		data["doc_as_upsert"] = true
	}
	return c.Update(index, _type, id, args, data)
}

// UpdateWithScript updates a document based on a script provided.
// The operation gets the document (collocated with the shard) from the index, runs the script
// (with optional script language and parameters), and index back the result (also allows to
// delete, or ignore the operation). It uses versioning to make sure no updates have happened
// during the "get" and "reindex". (available from 0.19 onwards).
//
// Note, this operation still means full reindex of the document, it just removes some network
// roundtrips and reduces chances of version conflicts between the get and the index. The _source
// field need to be enabled for this feature to work.
// http://www.elasticsearch.org/guide/reference/api/update.html
func (c *Conn) UpdateWithScript(index string, _type string, id string, args map[string]interface{}, script string, params interface{}) (BaseResponse, error) {
	switch v := params.(type) {
	case string:
		paramsPart := fmt.Sprintf("{\"params\":%s}", v)
		data := fmt.Sprintf("{\"script\":\"%s\", \"params\":%s}", script, paramsPart)
		return c.Update(index, _type, id, args, data)
	}
	var data map[string]interface{} = make(map[string]interface{})
	data["params"] = params
	data["script"] = script
	return c.Update(index, _type, id, args, data)
}
