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

package main

import (
	"bytes"
	"flag"
	"fmt"
	. "github.com/smartystreets/assertions/internal/ogletest"
	"go/build"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"syscall"
	"testing"
)

var dumpNew = flag.Bool("dump_new", false, "Dump new golden files.")

////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////

var tempDir string
var createmockPath string

type CreateMockTest struct {
}

func TestOgletest(t *testing.T) { RunTests(t) }
func init()                     { RegisterTestSuite(&CreateMockTest{}) }

func (t *CreateMockTest) SetUpTestSuite() {
	// Create a temporary file to hold the built createmock binary.
	tempDir, err := ioutil.TempDir("", "createmock-")
	if err != nil {
		panic("Creating temporary directory: " + err.Error())
	}

	createmockPath = path.Join(tempDir, "createmock")

	// Build the createmock tool so that it can be used in the tests below.
	cmd := exec.Command("go", "build", "-o", createmockPath, "github.com/smartystreets/assertions/internal/oglemock/createmock")
	if output, err := cmd.CombinedOutput(); err != nil {
		panic(fmt.Sprintf("Error building createmock: %v\n\n%s", err, output))
	}
}

func (t *CreateMockTest) TearDownTestSuite() {
	// Delete the createmock binary we built above.
	os.RemoveAll(tempDir)
	tempDir = ""
	createmockPath = ""
}

func (t *CreateMockTest) runGoldenTest(
	caseName string,
	expectedReturnCode int,
	createmockArgs ...string) {
	// Run createmock.
	cmd := exec.Command(createmockPath, createmockArgs...)
	output, err := cmd.CombinedOutput()

	// Make sure the process actually exited.
	exitError, ok := err.(*exec.ExitError)
	if err != nil && (!ok || !exitError.Exited()) {
		panic("exec.Command.CombinedOutput: " + err.Error())
	}

	// Extract a return code.
	var actualReturnCode int
	if exitError != nil {
		actualReturnCode = exitError.Sys().(syscall.WaitStatus).ExitStatus()
	}

	// Make sure the return code is correct.
	ExpectEq(expectedReturnCode, actualReturnCode)

	// Read the golden file.
	goldenPath := path.Join("test_cases", "golden."+caseName)
	goldenData := readFileOrDie(goldenPath)

	// Compare the two.
	identical := (string(output) == string(goldenData))
	ExpectTrue(identical, "Output doesn't match for case '%s'.", caseName)

	// Write out a new golden file if requested.
	if !identical && *dumpNew {
		writeContentsToFileOrDie(output, goldenPath)
	}
}

// Ensure that when createmock is run with the supplied args, it produces
// output that can be compiled.
func (t *CreateMockTest) runCompilationTest(createmockArgs ...string) {
	// Create a temporary directory inside of $GOPATH to hold generated code.
	buildPkg, err := build.Import("github.com/smartystreets/assertions/internal/oglemock", "", build.FindOnly)
	AssertEq(nil, err)

	tmpDir, err := ioutil.TempDir(buildPkg.SrcRoot, "tmp-createmock_test-")
	AssertEq(nil, err)
	defer os.RemoveAll(tmpDir)

	// Create a file to hold the mock code.
	codeFile, err := os.Create(path.Join(tmpDir, "mock.go"))
	AssertEq(nil, err)

	// Run createmock and save its output to the file created above.
	stdErrBuf := new(bytes.Buffer)

	cmd := exec.Command(createmockPath, createmockArgs...)
	cmd.Stdout = codeFile
	cmd.Stderr = stdErrBuf

	err = cmd.Run()
	AssertEq(nil, err, "createmock stderr output:\n\n%s", stdErrBuf.String())
	codeFile.Close()

	// Run 'go build' in the directory and make sure it exits with return code
	// zero.
	cmd = exec.Command("go", "build")
	cmd.Dir = tmpDir
	output, err := cmd.CombinedOutput()

	ExpectEq(nil, err, "go build output:\n\n%s", output)
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

func (t *CreateMockTest) NoPackage() {
	t.runGoldenTest(
		"no_package",
		1)
}

func (t *CreateMockTest) NoInterfaces() {
	t.runGoldenTest(
		"no_interfaces",
		1,
		"io")
}

func (t *CreateMockTest) UnknownPackage() {
	t.runGoldenTest(
		"unknown_package",
		1,
		"foo/bar",
		"Reader")
}

func (t *CreateMockTest) UnknownInterface() {
	t.runGoldenTest(
		"unknown_interface",
		1,
		"io",
		"Frobnicator")
}

func (t *CreateMockTest) IoReaderAndWriter() {
	t.runCompilationTest(
		"io",
		"Reader",
		"Writer")
}

func (t *CreateMockTest) OsFileInfo() {
	// Note that os is also used by the code that createmock generates; there
	// should be no conflict.
	t.runCompilationTest(
		"os",
		"FileInfo")
}

func (t *CreateMockTest) ComplicatedSamplePackage() {
	t.runCompilationTest(
		"github.com/smartystreets/assertions/internal/oglemock/generate/test_cases/complicated_pkg",
		"ComplicatedThing")
}

func (t *CreateMockTest) RenamedSamplePackage() {
	t.runCompilationTest(
		"github.com/smartystreets/assertions/internal/oglemock/generate/test_cases/renamed_pkg",
		"SomeInterface")
}
