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
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Unknwon/macaron"
	. "github.com/smartystreets/goconvey/convey"
)

var fileTestCases = []fileTestCase{
	{
		description: "Single file",
		singleFile: &fileInfo{
			fileName: "message.txt",
			data:     "All your binding are belong to us",
		},
	},
	{
		description: "Multiple files",
		multipleFiles: []*fileInfo{
			&fileInfo{
				fileName: "cool-gopher-fact.txt",
				data:     "Did you know? https://plus.google.com/+MatthewHolt/posts/GmVfd6TPJ51",
			},
			&fileInfo{
				fileName: "gophercon2014.txt",
				data:     "@bradfitz has a Go time machine: https://twitter.com/mholt6/status/459463953395875840",
			},
		},
	},
	{
		description: "Single file and multiple files",
		singleFile: &fileInfo{
			fileName: "social media.txt",
			data:     "Hey, you should follow @mholt6 (Twitter) or +MatthewHolt (Google+)",
		},
		multipleFiles: []*fileInfo{
			&fileInfo{
				fileName: "thank you!",
				data:     "Also, thanks to all the contributors of this package!",
			},
			&fileInfo{
				fileName: "btw...",
				data:     "This tool translates JSON into Go structs: http://mholt.github.io/json-to-go/",
			},
		},
	},
}

func Test_FileUploads(t *testing.T) {
	Convey("Test file upload", t, func() {
		for _, testCase := range fileTestCases {
			performFileTest(t, MultipartForm, testCase)
		}
	})
}

func performFileTest(t *testing.T, binder handlerFunc, testCase fileTestCase) {
	httpRecorder := httptest.NewRecorder()
	m := macaron.Classic()

	fileTestHandler := func(actual BlogPost, errs Errors) {
		assertFileAsExpected(t, testCase, actual.HeaderImage, testCase.singleFile)
		So(len(testCase.multipleFiles), ShouldEqual, len(actual.Pictures))

		for i, expectedFile := range testCase.multipleFiles {
			if i >= len(actual.Pictures) {
				break
			}
			assertFileAsExpected(t, testCase, actual.Pictures[i], expectedFile)
		}
	}

	m.Post(testRoute, binder(BlogPost{}), func(actual BlogPost, errs Errors) {
		fileTestHandler(actual, errs)
	})

	m.ServeHTTP(httpRecorder, buildRequestWithFile(testCase))

	switch httpRecorder.Code {
	case http.StatusNotFound:
		panic("Routing is messed up in test fixture (got 404): check methods and paths")
	case http.StatusInternalServerError:
		panic("Something bad happened on '" + testCase.description + "'")
	}
}

func assertFileAsExpected(t *testing.T, testCase fileTestCase, actual *multipart.FileHeader, expected *fileInfo) {
	if expected == nil && actual == nil {
		return
	}

	if expected != nil && actual == nil {
		So(actual, ShouldNotBeNil)
		return
	} else if expected == nil && actual != nil {
		So(actual, ShouldBeNil)
		return
	}

	So(actual.Filename, ShouldEqual, expected.fileName)
	So(unpackFileHeaderData(actual), ShouldEqual, expected.data)
}

func buildRequestWithFile(testCase fileTestCase) *http.Request {
	b := &bytes.Buffer{}
	w := multipart.NewWriter(b)

	if testCase.singleFile != nil {
		formFileSingle, err := w.CreateFormFile("header_image", testCase.singleFile.fileName)
		if err != nil {
			panic("Could not create FormFile (single file): " + err.Error())
		}
		formFileSingle.Write([]byte(testCase.singleFile.data))
	}

	for _, file := range testCase.multipleFiles {
		formFileMultiple, err := w.CreateFormFile("picture", file.fileName)
		if err != nil {
			panic("Could not create FormFile (multiple files): " + err.Error())
		}
		formFileMultiple.Write([]byte(file.data))
	}

	err := w.Close()
	if err != nil {
		panic("Could not close multipart writer: " + err.Error())
	}

	req, err := http.NewRequest("POST", testRoute, b)
	if err != nil {
		panic("Could not create file upload request: " + err.Error())
	}

	req.Header.Set("Content-Type", w.FormDataContentType())

	return req
}

func unpackFileHeaderData(fh *multipart.FileHeader) string {
	if fh == nil {
		return ""
	}

	f, err := fh.Open()
	if err != nil {
		panic("Could not open file header:" + err.Error())
	}
	defer f.Close()

	var fb bytes.Buffer
	_, err = fb.ReadFrom(f)
	if err != nil {
		panic("Could not read from file header:" + err.Error())
	}

	return fb.String()
}

type (
	fileTestCase struct {
		description   string
		input         BlogPost
		singleFile    *fileInfo
		multipleFiles []*fileInfo
	}

	fileInfo struct {
		fileName string
		data     string
	}
)
