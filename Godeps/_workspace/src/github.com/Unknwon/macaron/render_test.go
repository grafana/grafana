// Copyright 2013 Martini Authors
// Copyright 2014 Unknwon
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

package macaron

import (
	"encoding/xml"
	"html/template"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

type Greeting struct {
	One string `json:"one"`
	Two string `json:"two"`
}

type GreetingXML struct {
	XMLName xml.Name `xml:"greeting"`
	One     string   `xml:"one,attr"`
	Two     string   `xml:"two,attr"`
}

func Test_Render_JSON(t *testing.T) {
	Convey("Render JSON", t, func() {
		m := Classic()
		m.Use(Renderer())
		m.Get("/foobar", func(r Render) {
			r.JSON(300, Greeting{"hello", "world"})
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusMultipleChoices)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentJSON+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, `{"one":"hello","two":"world"}`)
	})

	Convey("Render JSON with prefix", t, func() {
		m := Classic()
		prefix := ")]}',\n"
		m.Use(Renderer(RenderOptions{
			PrefixJSON: []byte(prefix),
		}))
		m.Get("/foobar", func(r Render) {
			r.JSON(300, Greeting{"hello", "world"})
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusMultipleChoices)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentJSON+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, prefix+`{"one":"hello","two":"world"}`)
	})

	Convey("Render Indented JSON", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			IndentJSON: true,
		}))
		m.Get("/foobar", func(r Render) {
			r.JSON(300, Greeting{"hello", "world"})
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusMultipleChoices)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentJSON+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, `{
  "one": "hello",
  "two": "world"
}`)
	})

	Convey("Render JSON and return string", t, func() {
		m := Classic()
		m.Use(Renderer())
		m.Get("/foobar", func(r Render) {
			result, err := r.JSONString(Greeting{"hello", "world"})
			So(err, ShouldBeNil)
			So(result, ShouldEqual, `{"one":"hello","two":"world"}`)
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
	})

	Convey("Render with charset JSON", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Charset: "foobar",
		}))
		m.Get("/foobar", func(r Render) {
			r.JSON(300, Greeting{"hello", "world"})
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusMultipleChoices)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentJSON+"; charset=foobar")
		So(resp.Body.String(), ShouldEqual, `{"one":"hello","two":"world"}`)
	})
}

func Test_Render_XML(t *testing.T) {
	Convey("Render XML", t, func() {
		m := Classic()
		m.Use(Renderer())
		m.Get("/foobar", func(r Render) {
			r.XML(300, GreetingXML{One: "hello", Two: "world"})
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusMultipleChoices)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentXML+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, `<greeting one="hello" two="world"></greeting>`)
	})

	Convey("Render XML with prefix", t, func() {
		m := Classic()
		prefix := ")]}',\n"
		m.Use(Renderer(RenderOptions{
			PrefixXML: []byte(prefix),
		}))
		m.Get("/foobar", func(r Render) {
			r.XML(300, GreetingXML{One: "hello", Two: "world"})
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusMultipleChoices)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentXML+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, prefix+`<greeting one="hello" two="world"></greeting>`)
	})

	Convey("Render Indented XML", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			IndentXML: true,
		}))
		m.Get("/foobar", func(r Render) {
			r.XML(300, GreetingXML{One: "hello", Two: "world"})
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusMultipleChoices)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentXML+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, `<greeting one="hello" two="world"></greeting>`)
	})
}

func Test_Render_HTML(t *testing.T) {
	Convey("Render HTML", t, func() {
		m := Classic()
		m.Use(Renderers(RenderOptions{
			Directory: "fixtures/basic",
		}, "fixtures/basic2"))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "hello", "jeremy")
			r.SetTemplatePath("", "fixtures/basic2")
		})
		m.Get("/foobar2", func(r Render) {
			if r.HasTemplateSet("basic2") {
				r.HTMLSet(200, "basic2", "hello", "jeremy")
			}
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentHTML+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, "<h1>Hello jeremy</h1>")

		resp = httptest.NewRecorder()
		req, err = http.NewRequest("GET", "/foobar2", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentHTML+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, "<h1>What's up, jeremy</h1>")

		Convey("Change render templates path", func() {
			resp := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "/foobar", nil)
			So(err, ShouldBeNil)
			m.ServeHTTP(resp, req)

			So(resp.Code, ShouldEqual, http.StatusOK)
			So(resp.Header().Get(ContentType), ShouldEqual, ContentHTML+"; charset=UTF-8")
			So(resp.Body.String(), ShouldEqual, "<h1>What's up, jeremy</h1>")
		})
	})

	Convey("Render HTML and return string", t, func() {
		m := Classic()
		m.Use(Renderers(RenderOptions{
			Directory: "fixtures/basic",
		}, "basic2:fixtures/basic2"))
		m.Get("/foobar", func(r Render) {
			result, err := r.HTMLString("hello", "jeremy")
			So(err, ShouldBeNil)
			So(result, ShouldEqual, "<h1>Hello jeremy</h1>")
		})
		m.Get("/foobar2", func(r Render) {
			result, err := r.HTMLSetString("basic2", "hello", "jeremy")
			So(err, ShouldBeNil)
			So(result, ShouldEqual, "<h1>What's up, jeremy</h1>")
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		resp = httptest.NewRecorder()
		req, err = http.NewRequest("GET", "/foobar2", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)
	})

	Convey("Render with nested HTML", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Directory: "fixtures/basic",
		}))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "admin/index", "jeremy")
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentHTML+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, "<h1>Admin jeremy</h1>")
	})

	Convey("Render bad HTML", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Directory: "fixtures/basic",
		}))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "nope", nil)
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusInternalServerError)
		So(resp.Body.String(), ShouldEqual, "html/template: \"nope\" is undefined\n")
	})

	Convey("Invalid template set", t, func() {
		Convey("Empty template set argument", func() {
			defer func() {
				So(recover(), ShouldNotBeNil)
			}()
			m := Classic()
			m.Use(Renderers(RenderOptions{
				Directory: "fixtures/basic",
			}, ""))
		})

		Convey("Bad template set path", func() {
			defer func() {
				So(recover(), ShouldNotBeNil)
			}()
			m := Classic()
			m.Use(Renderers(RenderOptions{
				Directory: "fixtures/basic",
			}, "404"))
		})
	})
}

func Test_Render_XHTML(t *testing.T) {
	Convey("Render XHTML", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Directory:       "fixtures/basic",
			HTMLContentType: ContentXHTML,
		}))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "hello", "jeremy")
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentXHTML+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, "<h1>Hello jeremy</h1>")
	})
}

func Test_Render_Extensions(t *testing.T) {
	Convey("Render with extensions", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Directory:  "fixtures/basic",
			Extensions: []string{".tmpl", ".html"},
		}))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "hypertext", nil)
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentHTML+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, "Hypertext!")
	})
}

func Test_Render_Funcs(t *testing.T) {
	Convey("Render with functions", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Directory: "fixtures/custom_funcs",
			Funcs: []template.FuncMap{
				{
					"myCustomFunc": func() string {
						return "My custom function"
					},
				},
			},
		}))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "index", "jeremy")
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Body.String(), ShouldEqual, "My custom function")
	})
}

func Test_Render_Layout(t *testing.T) {
	Convey("Render with layout", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Directory: "fixtures/basic",
			Layout:    "layout",
		}))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "content", "jeremy")
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Body.String(), ShouldEqual, "head<h1>jeremy</h1>foot")
	})

	Convey("Render with current layout", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Directory: "fixtures/basic",
			Layout:    "current_layout",
		}))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "content", "jeremy")
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Body.String(), ShouldEqual, "content head<h1>jeremy</h1>content foot")
	})

	Convey("Render with override layout", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Directory: "fixtures/basic",
			Layout:    "layout",
		}))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "content", "jeremy", HTMLOptions{
				Layout: "another_layout",
			})
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentHTML+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, "another head<h1>jeremy</h1>another foot")
	})
}

func Test_Render_Delimiters(t *testing.T) {
	Convey("Render with delimiters", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Delims:    Delims{"{[{", "}]}"},
			Directory: "fixtures/basic",
		}))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "delims", "jeremy")
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentHTML+"; charset=UTF-8")
		So(resp.Body.String(), ShouldEqual, "<h1>Hello jeremy</h1>")
	})
}

func Test_Render_BinaryData(t *testing.T) {
	Convey("Render binary data", t, func() {
		m := Classic()
		m.Use(Renderer())
		m.Get("/foobar", func(r Render) {
			r.RawData(200, []byte("hello there"))
		})
		m.Get("/foobar2", func(r Render) {
			r.RenderData(200, []byte("hello there"))
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get(ContentType), ShouldEqual, ContentBinary)
		So(resp.Body.String(), ShouldEqual, "hello there")

		resp = httptest.NewRecorder()
		req, err = http.NewRequest("GET", "/foobar2", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get(ContentType), ShouldEqual, CONTENT_PLAIN)
		So(resp.Body.String(), ShouldEqual, "hello there")
	})

	Convey("Render binary data with mime type", t, func() {
		m := Classic()
		m.Use(Renderer())
		m.Get("/foobar", func(r Render) {
			r.RW().Header().Set(ContentType, "image/jpeg")
			r.RawData(200, []byte("..jpeg data.."))
		})

		resp := httptest.NewRecorder()
		req, err := http.NewRequest("GET", "/foobar", nil)
		So(err, ShouldBeNil)
		m.ServeHTTP(resp, req)

		So(resp.Code, ShouldEqual, http.StatusOK)
		So(resp.Header().Get(ContentType), ShouldEqual, "image/jpeg")
		So(resp.Body.String(), ShouldEqual, "..jpeg data..")
	})
}

func Test_Render_Status(t *testing.T) {
	Convey("Render with status 204", t, func() {
		resp := httptest.NewRecorder()
		r := TplRender{resp, newTemplateSet(), &RenderOptions{}, "", time.Now()}
		r.Status(204)
		So(resp.Code, ShouldEqual, http.StatusNoContent)
	})

	Convey("Render with status 404", t, func() {
		resp := httptest.NewRecorder()
		r := TplRender{resp, newTemplateSet(), &RenderOptions{}, "", time.Now()}
		r.Error(404)
		So(resp.Code, ShouldEqual, http.StatusNotFound)
	})

	Convey("Render with status 500", t, func() {
		resp := httptest.NewRecorder()
		r := TplRender{resp, newTemplateSet(), &RenderOptions{}, "", time.Now()}
		r.Error(500)
		So(resp.Code, ShouldEqual, http.StatusInternalServerError)
	})
}

func Test_Render_NoRace(t *testing.T) {
	Convey("Make sure render has no race", t, func() {
		m := Classic()
		m.Use(Renderer(RenderOptions{
			Directory: "fixtures/basic",
		}))
		m.Get("/foobar", func(r Render) {
			r.HTML(200, "hello", "world")
		})

		done := make(chan bool)
		doreq := func() {
			resp := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/foobar", nil)
			m.ServeHTTP(resp, req)
			done <- true
		}
		// Run two requests to check there is no race condition
		go doreq()
		go doreq()
		<-done
		<-done
	})
}

func Test_GetExt(t *testing.T) {
	Convey("Get extension", t, func() {
		So(GetExt("test"), ShouldBeBlank)
		So(GetExt("test.tmpl"), ShouldEqual, ".tmpl")
		So(GetExt("test.go.tmpl"), ShouldEqual, ".go.tmpl")
	})
}
