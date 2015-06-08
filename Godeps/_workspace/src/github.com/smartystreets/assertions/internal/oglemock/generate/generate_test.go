// Copyright 2012 Aaron Jacobs. All Rights Reserved.
// Author: aaronjjacobs@gmail.com (Aaron Jacobs)
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

package generate_test

import (
	"bytes"
	"flag"
	. "github.com/smartystreets/assertions/internal/oglematchers"
	"github.com/smartystreets/assertions/internal/oglemock/generate"
	"github.com/smartystreets/assertions/internal/oglemock/generate/test_cases/complicated_pkg"
	"github.com/smartystreets/assertions/internal/oglemock/generate/test_cases/renamed_pkg"
	. "github.com/smartystreets/assertions/internal/ogletest"
	"image"
	"io"
	"io/ioutil"
	"path"
	"reflect"
	"testing"
)

var dumpNew = flag.Bool("dump_new", false, "Dump new golden files.")

////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////

type GenerateTest struct {
}

func TestOgletest(t *testing.T) { RunTests(t) }
func init()                     { RegisterTestSuite(&GenerateTest{}) }

func (t *GenerateTest) runGoldenTest(
	caseName string,
	nilPtrs ...interface{}) {
	// Make a slice of interface types to give to GenerateMockSource.
	interfaces := make([]reflect.Type, len(nilPtrs))
	for i, ptr := range nilPtrs {
		interfaces[i] = reflect.TypeOf(ptr).Elem()
	}

	// Create the mock source.
	buf := new(bytes.Buffer)
	err := generate.GenerateMockSource(buf, "some_pkg", interfaces)
	AssertEq(nil, err, "Error from GenerateMockSource: %v", err)

	// Read the golden file.
	goldenPath := path.Join("test_cases", "golden."+caseName+".go")
	goldenData := readFileOrDie(goldenPath)

	// Compare the two.
	identical := (buf.String() == string(goldenData))
	ExpectTrue(identical, "Output doesn't match for case '%s'.", caseName)

	// Write out a new golden file if requested.
	if !identical && *dumpNew {
		writeContentsToFileOrDie(buf.Bytes(), goldenPath)
	}
}

func writeContentsToFileOrDie(contents []byte, path string) {
	if err := ioutil.WriteFile(path, contents, 0600); err != nil {
		panic("ioutil.WriteFile: " + err.Error())
	}
}

func readFileOrDie(path string) []byte {
	contents, err := ioutil.ReadFile(path)
	if err != nil {
		panic("ioutil.ReadFile: " + err.Error())
	}

	return contents
}

////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////

func (t *GenerateTest) EmptyPackageName() {
	err := generate.GenerateMockSource(
		new(bytes.Buffer),
		"",
		[]reflect.Type{
			reflect.TypeOf((*io.Reader)(nil)).Elem(),
		})

	ExpectThat(err, Error(HasSubstr("Package name")))
	ExpectThat(err, Error(HasSubstr("non-empty")))
}

func (t *GenerateTest) EmptySetOfInterfaces() {
	err := generate.GenerateMockSource(
		new(bytes.Buffer),
		"foo",
		[]reflect.Type{})

	ExpectThat(err, Error(HasSubstr("interfaces")))
	ExpectThat(err, Error(HasSubstr("non-empty")))
}

func (t *GenerateTest) NonInterfaceType() {
	err := generate.GenerateMockSource(
		new(bytes.Buffer),
		"foo",
		[]reflect.Type{
			reflect.TypeOf((*io.Reader)(nil)).Elem(),
			reflect.TypeOf(17),
			reflect.TypeOf((*io.Writer)(nil)).Elem(),
		})

	ExpectThat(err, Error(HasSubstr("Invalid type")))
}

func (t *GenerateTest) IoReaderAndWriter() {
	// Mock io.Reader and io.Writer.
	t.runGoldenTest(
		"io_reader_writer",
		(*io.Reader)(nil),
		(*io.Writer)(nil))
}

func (t *GenerateTest) Image() {
	t.runGoldenTest(
		"image",
		(*image.Image)(nil),
		(*image.PalettedImage)(nil))
}

func (t *GenerateTest) ComplicatedPackage() {
	t.runGoldenTest(
		"complicated_pkg",
		(*complicated_pkg.ComplicatedThing)(nil))
}

func (t *GenerateTest) RenamedPackage() {
	t.runGoldenTest(
		"renamed_pkg",
		(*tony.SomeInterface)(nil))
}
