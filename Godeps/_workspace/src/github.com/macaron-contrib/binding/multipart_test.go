// Copyright 2014 martini-contrib/binding Authors
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

package binding

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/Unknwon/macaron"
	. "github.com/smartystreets/goconvey/convey"
)

var multipartFormTestCases = []multipartFormTestCase{
	{
		description:      "Happy multipart form path",
		shouldSucceed:    true,
		inputAndExpected: BlogPost{Post: Post{Title: "Glorious Post Title"}, Id: 1, Author: Person{Name: "Matt Holt"}},
	},
	{
		description:         "FormValue called before req.MultipartReader(); see https://github.com/martini-contrib/csrf/issues/6",
		shouldSucceed:       true,
		callFormValueBefore: true,
		inputAndExpected:    BlogPost{Post: Post{Title: "Glorious Post Title"}, Id: 1, Author: Person{Name: "Matt Holt"}},
	},
	{
		description:      "Empty payload",
		shouldSucceed:    false,
		inputAndExpected: BlogPost{},
	},
	{
		description:      "Missing required field (Id)",
		shouldSucceed:    false,
		inputAndExpected: BlogPost{Post: Post{Title: "Glorious Post Title"}, Author: Person{Name: "Matt Holt"}},
	},
	{
		description:      "Required embedded struct field not specified",
		shouldSucceed:    false,
		inputAndExpected: BlogPost{Id: 1, Author: Person{Name: "Matt Holt"}},
	},
	{
		description:      "Required nested struct field not specified",
		shouldSucceed:    false,
		inputAndExpected: BlogPost{Post: Post{Title: "Glorious Post Title"}, Id: 1},
	},
	{
		description:      "Multiple values",
		shouldSucceed:    true,
		inputAndExpected: BlogPost{Post: Post{Title: "Glorious Post Title"}, Id: 1, Author: Person{Name: "Matt Holt"}, Ratings: []int{3, 5, 4}},
	},
	{
		description:     "Bad multipart encoding",
		shouldSucceed:   false,
		malformEncoding: true,
	},
}

func Test_MultipartForm(t *testing.T) {
	Convey("Test multipart form", t, func() {
		for _, testCase := range multipartFormTestCases {
			performMultipartFormTest(t, MultipartForm, testCase)
		}
	})
}

func performMultipartFormTest(t *testing.T, binder handlerFunc, testCase multipartFormTestCase) {
	httpRecorder := httptest.NewRecorder()
	m := macaron.Classic()

	m.Post(testRoute, binder(BlogPost{}), func(actual BlogPost, errs Errors) {
		if testCase.shouldSucceed && len(errs) > 0 {
			So(len(errs), ShouldEqual, 0)
		} else if !testCase.shouldSucceed && len(errs) == 0 {
			So(len(errs), ShouldNotEqual, 0)
		}
		So(fmt.Sprintf("%+v", actual), ShouldEqual, fmt.Sprintf("%+v", testCase.inputAndExpected))
	})

	multipartPayload, mpWriter := makeMultipartPayload(testCase)

	req, err := http.NewRequest("POST", testRoute, multipartPayload)
	if err != nil {
		panic(err)
	}

	req.Header.Add("Content-Type", mpWriter.FormDataContentType())

	err = mpWriter.Close()
	if err != nil {
		panic(err)
	}

	if testCase.callFormValueBefore {
		req.FormValue("foo")
	}

	m.ServeHTTP(httpRecorder, req)

	switch httpRecorder.Code {
	case http.StatusNotFound:
		panic("Routing is messed up in test fixture (got 404): check methods and paths")
	case http.StatusInternalServerError:
		panic("Something bad happened on '" + testCase.description + "'")
	}
}

// Writes the input from a test case into a buffer using the multipart writer.
func makeMultipartPayload(testCase multipartFormTestCase) (*bytes.Buffer, *multipart.Writer) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if testCase.malformEncoding {
		// TODO: Break the multipart form parser which is apparently impervious!!
		// (Get it to return an error. Trying to get 100% test coverage.)
		body.Write([]byte(`--` + writer.Boundary() + `\nContent-Disposition: form-data; name="foo"\n\n--` + writer.Boundary() + `--`))
		return body, writer
	} else {
		writer.WriteField("title", testCase.inputAndExpected.Title)
		writer.WriteField("content", testCase.inputAndExpected.Content)
		writer.WriteField("id", strconv.Itoa(testCase.inputAndExpected.Id))
		writer.WriteField("ignored", testCase.inputAndExpected.Ignored)
		for _, value := range testCase.inputAndExpected.Ratings {
			writer.WriteField("rating", strconv.Itoa(value))
		}
		writer.WriteField("name", testCase.inputAndExpected.Author.Name)
		writer.WriteField("email", testCase.inputAndExpected.Author.Email)
		return body, writer
	}
}

type (
	multipartFormTestCase struct {
		description         string
		shouldSucceed       bool
		inputAndExpected    BlogPost
		malformEncoding     bool
		callFormValueBefore bool
	}
)
