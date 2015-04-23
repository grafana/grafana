// Copyright 2015 Unknwon
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package bindata

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Unknwon/macaron"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/macaron-contrib/bindata/testdata"
)

func Test_Version(t *testing.T) {
	Convey("Get version", t, func() {
		So(Version(), ShouldEqual, _VERSION)
	})
}

func Test_Bindata(t *testing.T) {
	Convey("Bindata service", t, func() {
		m := macaron.New()
		m.Use(macaron.Static("",
			macaron.StaticOptions{
				SkipLogging: false,
				FileSystem: Static(Options{
					Asset:      testdata.Asset,
					AssetDir:   testdata.AssetDir,
					AssetNames: testdata.AssetNames,
					Prefix:     "",
				}),
			},
		))
		m.Use(macaron.Renderer(macaron.RenderOptions{
			TemplateFileSystem: Templates(Options{
				Asset:      testdata.Asset,
				AssetDir:   testdata.AssetDir,
				AssetNames: testdata.AssetNames,
				Prefix:     "",
			}),
		}))
		m.Get("/", func(ctx *macaron.Context) {
			ctx.HTML(200, "templates/hello", "Joe")
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/static/hello.css", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, ".hello.world {\n\tfont-size: 1px;\n}")

		resp = httptest.NewRecorder()
		req, err = http.NewRequest("GET", "/", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
		So(resp.Body.String(), ShouldEqual, "Hello, Joe!")
	})
}
