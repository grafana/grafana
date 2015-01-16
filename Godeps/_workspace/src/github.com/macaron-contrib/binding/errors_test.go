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
	"fmt"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func Test_ErrorsAdd(t *testing.T) {
	Convey("Add new error", t, func() {
		var actual Errors
		expected := Errors{
			Error{
				FieldNames:     []string{"Field1", "Field2"},
				Classification: "ErrorClass",
				Message:        "Some message",
			},
		}

		actual.Add(expected[0].FieldNames, expected[0].Classification, expected[0].Message)

		So(len(actual), ShouldEqual, 1)
		So(fmt.Sprintf("%#v", actual), ShouldEqual, fmt.Sprintf("%#v", expected))
	})
}

func Test_ErrorsLen(t *testing.T) {
	Convey("Get number of errors", t, func() {
		So(errorsTestSet.Len(), ShouldEqual, len(errorsTestSet))
	})
}

func Test_ErrorsHas(t *testing.T) {
	Convey("Check error class", t, func() {
		So(errorsTestSet.Has("ClassA"), ShouldBeTrue)
		So(errorsTestSet.Has("ClassQ"), ShouldBeFalse)
	})
}

func Test_ErrorGetters(t *testing.T) {
	Convey("Get error detail", t, func() {
		err := Error{
			FieldNames:     []string{"field1", "field2"},
			Classification: "ErrorClass",
			Message:        "The message",
		}

		fieldsActual := err.Fields()

		So(len(fieldsActual), ShouldEqual, 2)
		So(fieldsActual[0], ShouldEqual, "field1")
		So(fieldsActual[1], ShouldEqual, "field2")

		So(err.Kind(), ShouldEqual, "ErrorClass")
		So(err.Error(), ShouldEqual, "The message")
	})
}

/*
func TestErrorsWithClass(t *testing.T) {
	expected := Errors{
		errorsTestSet[0],
		errorsTestSet[3],
	}
	actualStr := fmt.Sprintf("%#v", errorsTestSet.WithClass("ClassA"))
	expectedStr := fmt.Sprintf("%#v", expected)
	if actualStr != expectedStr {
		t.Errorf("Expected:\n%s\nbut got:\n%s", expectedStr, actualStr)
	}
}
*/

var errorsTestSet = Errors{
	Error{
		FieldNames:     []string{},
		Classification: "ClassA",
		Message:        "Foobar",
	},
	Error{
		FieldNames:     []string{},
		Classification: "ClassB",
		Message:        "Foo",
	},
	Error{
		FieldNames:     []string{"field1", "field2"},
		Classification: "ClassB",
		Message:        "Foobar",
	},
	Error{
		FieldNames:     []string{"field2"},
		Classification: "ClassA",
		Message:        "Foobar",
	},
	Error{
		FieldNames:     []string{"field2"},
		Classification: "ClassB",
		Message:        "Foobar",
	},
}
