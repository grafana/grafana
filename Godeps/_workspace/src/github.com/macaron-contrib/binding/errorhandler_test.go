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
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

var errorTestCases = []errorTestCase{
	{
		description: "No errors",
		errors:      Errors{},
		expected: errorTestResult{
			statusCode: http.StatusOK,
		},
	},
	{
		description: "Deserialization error",
		errors: Errors{
			{
				Classification: ERR_DESERIALIZATION,
				Message:        "Some parser error here",
			},
		},
		expected: errorTestResult{
			statusCode:  http.StatusBadRequest,
			contentType: _JSON_CONTENT_TYPE,
			body:        `[{"classification":"DeserializationError","message":"Some parser error here"}]`,
		},
	},
	{
		description: "Content-Type error",
		errors: Errors{
			{
				Classification: ERR_CONTENT_TYPE,
				Message:        "Empty Content-Type",
			},
		},
		expected: errorTestResult{
			statusCode:  http.StatusUnsupportedMediaType,
			contentType: _JSON_CONTENT_TYPE,
			body:        `[{"classification":"ContentTypeError","message":"Empty Content-Type"}]`,
		},
	},
	{
		description: "Requirement error",
		errors: Errors{
			{
				FieldNames:     []string{"some_field"},
				Classification: ERR_REQUIRED,
				Message:        "Required",
			},
		},
		expected: errorTestResult{
			statusCode:  STATUS_UNPROCESSABLE_ENTITY,
			contentType: _JSON_CONTENT_TYPE,
			body:        `[{"fieldNames":["some_field"],"classification":"RequiredError","message":"Required"}]`,
		},
	},
	{
		description: "Bad header error",
		errors: Errors{
			{
				Classification: "HeaderError",
				Message:        "The X-Something header must be specified",
			},
		},
		expected: errorTestResult{
			statusCode:  STATUS_UNPROCESSABLE_ENTITY,
			contentType: _JSON_CONTENT_TYPE,
			body:        `[{"classification":"HeaderError","message":"The X-Something header must be specified"}]`,
		},
	},
	{
		description: "Custom field error",
		errors: Errors{
			{
				FieldNames:     []string{"month", "year"},
				Classification: "DateError",
				Message:        "The month and year must be in the future",
			},
		},
		expected: errorTestResult{
			statusCode:  STATUS_UNPROCESSABLE_ENTITY,
			contentType: _JSON_CONTENT_TYPE,
			body:        `[{"fieldNames":["month","year"],"classification":"DateError","message":"The month and year must be in the future"}]`,
		},
	},
	{
		description: "Multiple errors",
		errors: Errors{
			{
				FieldNames:     []string{"foo"},
				Classification: ERR_REQUIRED,
				Message:        "Required",
			},
			{
				FieldNames:     []string{"foo"},
				Classification: "LengthError",
				Message:        "The length of the 'foo' field is too short",
			},
		},
		expected: errorTestResult{
			statusCode:  STATUS_UNPROCESSABLE_ENTITY,
			contentType: _JSON_CONTENT_TYPE,
			body:        `[{"fieldNames":["foo"],"classification":"RequiredError","message":"Required"},{"fieldNames":["foo"],"classification":"LengthError","message":"The length of the 'foo' field is too short"}]`,
		},
	},
}

func Test_ErrorHandler(t *testing.T) {
	Convey("Error handler", t, func() {
		for _, testCase := range errorTestCases {
			performErrorTest(t, testCase)
		}
	})
}

func performErrorTest(t *testing.T, testCase errorTestCase) {
	resp := httptest.NewRecorder()

	errorHandler(testCase.errors, resp)

	So(resp.Code, ShouldEqual, testCase.expected.statusCode)
	So(resp.Header().Get("Content-Type"), ShouldEqual, testCase.expected.contentType)

	actualBody, err := ioutil.ReadAll(resp.Body)
	So(err, ShouldBeNil)
	So(string(actualBody), ShouldEqual, testCase.expected.body)
}

type (
	errorTestCase struct {
		description string
		errors      Errors
		expected    errorTestResult
	}

	errorTestResult struct {
		statusCode  int
		contentType string
		body        string
	}
)
