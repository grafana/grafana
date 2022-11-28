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
	"html/template"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
)

// Renderer is a Middleware that injects a template renderer into the macaron context, enabling ctx.HTML calls in the handlers.
// If MACARON_ENV is set to "development" then templates will be recompiled on every request. For more performance, set the
// MACARON_ENV environment variable to "production".
func Renderer(dir, leftDelim, rightDelim string) Middleware {
	fs := os.DirFS(dir)
	t, err := compileTemplates(fs, leftDelim, rightDelim)
	if err != nil {
		panic("Renderer: " + err.Error())
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			ctx := FromContext(req.Context())
			if Env == DEV {
				if t, err = compileTemplates(fs, leftDelim, rightDelim); err != nil {
					panic("Context.HTML:" + err.Error())
				}
			}
			ctx.template = t
			next.ServeHTTP(rw, req)
		})
	}
}

func compileTemplates(filesystem fs.FS, leftDelim, rightDelim string) (*template.Template, error) {
	t := template.New("")
	t.Delims(leftDelim, rightDelim)
	err := fs.WalkDir(filesystem, ".", func(path string, d fs.DirEntry, e error) error {
		if e != nil {
			return nil // skip unreadable or erroneous filesystem items
		}
		if d.IsDir() {
			return nil
		}
		ext := filepath.Ext(path)
		if ext != ".html" && ext != ".tmpl" {
			return nil
		}
		data, err := fs.ReadFile(filesystem, path)
		if err != nil {
			return err
		}
		basename := path[:len(path)-len(ext)]
		_, err = t.New(basename).Parse(string(data))
		return err
	})
	return t, err
}
