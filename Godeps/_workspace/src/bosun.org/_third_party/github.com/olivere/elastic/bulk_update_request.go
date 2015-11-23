// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Bulk request to update document in Elasticsearch.
type BulkUpdateRequest struct {
	BulkableRequest
	index string
	typ   string
	id    string

	routing         string
	parent          string
	script          string
	scriptType      string
	scriptLang      string
	scriptParams    map[string]interface{}
	version         int64  // default is MATCH_ANY
	versionType     string // default is "internal"
	retryOnConflict *int
	refresh         *bool
	upsert          interface{}
	docAsUpsert     *bool
	doc             interface{}
	ttl             int64
	timestamp       string
}

func NewBulkUpdateRequest() *BulkUpdateRequest {
	return &BulkUpdateRequest{}
}

func (r *BulkUpdateRequest) Index(index string) *BulkUpdateRequest {
	r.index = index
	return r
}

func (r *BulkUpdateRequest) Type(typ string) *BulkUpdateRequest {
	r.typ = typ
	return r
}

func (r *BulkUpdateRequest) Id(id string) *BulkUpdateRequest {
	r.id = id
	return r
}

func (r *BulkUpdateRequest) Routing(routing string) *BulkUpdateRequest {
	r.routing = routing
	return r
}

func (r *BulkUpdateRequest) Parent(parent string) *BulkUpdateRequest {
	r.parent = parent
	return r
}

func (r *BulkUpdateRequest) Script(script string) *BulkUpdateRequest {
	r.script = script
	return r
}

func (r *BulkUpdateRequest) ScriptType(scriptType string) *BulkUpdateRequest {
	r.scriptType = scriptType
	return r
}

func (r *BulkUpdateRequest) ScriptLang(scriptLang string) *BulkUpdateRequest {
	r.scriptLang = scriptLang
	return r
}

func (r *BulkUpdateRequest) ScriptParams(params map[string]interface{}) *BulkUpdateRequest {
	r.scriptParams = params
	return r
}

func (r *BulkUpdateRequest) RetryOnConflict(retryOnConflict int) *BulkUpdateRequest {
	r.retryOnConflict = &retryOnConflict
	return r
}

func (r *BulkUpdateRequest) Version(version int64) *BulkUpdateRequest {
	r.version = version
	return r
}

// VersionType can be "internal" (default), "external", "external_gte",
// "external_gt", or "force".
func (r *BulkUpdateRequest) VersionType(versionType string) *BulkUpdateRequest {
	r.versionType = versionType
	return r
}

func (r *BulkUpdateRequest) Refresh(refresh bool) *BulkUpdateRequest {
	r.refresh = &refresh
	return r
}

func (r *BulkUpdateRequest) Doc(doc interface{}) *BulkUpdateRequest {
	r.doc = doc
	return r
}

func (r *BulkUpdateRequest) DocAsUpsert(docAsUpsert bool) *BulkUpdateRequest {
	r.docAsUpsert = &docAsUpsert
	return r
}

func (r *BulkUpdateRequest) Upsert(doc interface{}) *BulkUpdateRequest {
	r.upsert = doc
	return r
}

func (r *BulkUpdateRequest) Ttl(ttl int64) *BulkUpdateRequest {
	r.ttl = ttl
	return r
}

func (r *BulkUpdateRequest) Timestamp(timestamp string) *BulkUpdateRequest {
	r.timestamp = timestamp
	return r
}

func (r *BulkUpdateRequest) String() string {
	lines, err := r.Source()
	if err == nil {
		return strings.Join(lines, "\n")
	}
	return fmt.Sprintf("error: %v", err)
}

func (r *BulkUpdateRequest) getSourceAsString(data interface{}) (string, error) {
	switch t := data.(type) {
	default:
		body, err := json.Marshal(data)
		if err != nil {
			return "", err
		}
		return string(body), nil
	case json.RawMessage:
		return string(t), nil
	case *json.RawMessage:
		return string(*t), nil
	case string:
		return t, nil
	case *string:
		return *t, nil
	}
}

func (r BulkUpdateRequest) Source() ([]string, error) {
	// { "update" : { "_index" : "test", "_type" : "type1", "_id" : "1", ... } }
	// { "doc" : { "field1" : "value1", ... } }
	// or
	// { "update" : { "_index" : "test", "_type" : "type1", "_id" : "1", ... } }
	// { "script" : { ... } }

	lines := make([]string, 2)

	// "update" ...
	command := make(map[string]interface{})
	updateCommand := make(map[string]interface{})
	if r.index != "" {
		updateCommand["_index"] = r.index
	}
	if r.typ != "" {
		updateCommand["_type"] = r.typ
	}
	if r.id != "" {
		updateCommand["_id"] = r.id
	}
	if r.routing != "" {
		updateCommand["_routing"] = r.routing
	}
	if r.parent != "" {
		updateCommand["_parent"] = r.parent
	}
	if r.timestamp != "" {
		updateCommand["_timestamp"] = r.timestamp
	}
	if r.ttl > 0 {
		updateCommand["_ttl"] = r.ttl
	}
	if r.version > 0 {
		updateCommand["_version"] = r.version
	}
	if r.versionType != "" {
		updateCommand["_version_type"] = r.versionType
	}
	if r.refresh != nil {
		updateCommand["refresh"] = *r.refresh
	}
	if r.retryOnConflict != nil {
		updateCommand["_retry_on_conflict"] = *r.retryOnConflict
	}
	if r.upsert != nil {
		updateCommand["upsert"] = r.upsert
	}
	command["update"] = updateCommand
	line, err := json.Marshal(command)
	if err != nil {
		return nil, err
	}
	lines[0] = string(line)

	// 2nd line: {"doc" : { ... }} or {"script": {...}}
	source := make(map[string]interface{})
	if r.docAsUpsert != nil {
		source["doc_as_upsert"] = *r.docAsUpsert
	}
	if r.doc != nil {
		// {"doc":{...}}
		source["doc"] = r.doc
	} else if r.script != "" {
		// {"script":...}
		source["script"] = r.script
		if r.scriptLang != "" {
			source["lang"] = r.scriptLang
		}
		/*
			if r.scriptType != "" {
				source["script_type"] = r.scriptType
			}
		*/
		if r.scriptParams != nil && len(r.scriptParams) > 0 {
			source["params"] = r.scriptParams
		}
	}
	lines[1], err = r.getSourceAsString(source)
	if err != nil {
		return nil, err
	}

	return lines, nil
}
