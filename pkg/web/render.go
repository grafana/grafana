// Copyright 2013 Martini Authors
// Copyright 2014 The Macaron Authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package web

import (
	"encoding/json"
	"html/template"
	"net/http"
)

func Template(w http.ResponseWriter, status int, t *template.Template, data interface{}) {
	SetContentType(w, TextHTML)
	w.WriteHeader(status)
	if err := t.Execute(w, data); err != nil {
		panic("web.Template: " + err.Error())
	}
}

func JSON(w http.ResponseWriter, status int, data interface{}) {
	SetContentType(w, AppJSON)
	w.WriteHeader(status)

	enc := json.NewEncoder(w)
	if Env != PROD {
		enc.SetIndent("", "  ")
	}
	if err := enc.Encode(data); err != nil {
		panic("web.JSON: " + err.Error())
	}
}
