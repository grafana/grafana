// Copyright 2011 Aaron Jacobs. All Rights Reserved.
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

package ogletest_test

import (
	"errors"
	"flag"
	"fmt"
	"go/build"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"regexp"
	"strings"
	"syscall"
	"testing"
)

const ogletestPkg = "github.com/smartystreets/assertions/internal/ogletest"

var dumpNew = flag.Bool("dump_new", false, "Dump new golden files.")
var objDir string

////////////////////////////////////////////////////////////////////////
// Helpers
////////////////////////////////////////////////////////////////////////

// Install the possibly locally-modified copy of ogletest, so that these
// integration tests run using the package currently being worked on by the
// programmer. Also install other dependencies needed by the test cases, so
// that `go test` complaining about non-up-to-date packages doesn't make it
// into the golden files.
func installLocalPackages() error {
	cmd := exec.Command(
		"go",
		"install",
		ogletestPkg,
		"github.com/smartystreets/assertions/internal/oglemock",
		"github.com/smartystreets/assertions/internal/ogletest/test_cases/mock_image")

	output, err := cmd.CombinedOutput()

	if err != nil {
		return errors.New(fmt.Sprintf("%v:\n%s", err, output))
	}

	return nil
}

// getCaseNames looks for integration test cases as files in the test_cases
// directory.
func getCaseNames() ([]string, error) {
	// Open the test cases directory.
	dir, err := os.Open("test_cases")
	if err != nil {
		return nil, errors.New(fmt.Sprintf("Opening dir: %v", err))
	}

	// Get a list of the names in the directory.
	names, err := dir.Readdirnames(0)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("Readdirnames: %v", err))
	}

	// Filter the names.
	result := make([]string, len(names))
	resultLen := 0
	for _, name := range names {
		// Skip golden files and hidden files.
		if strings.HasPrefix(name, "golden.") || strings.HasPrefix(name, ".") {
			continue
		}

		// Check for the right format.
		if !strings.HasSuffix(name, ".test.go") {
			continue
		}

		// Store the name minus the extension.
		result[resultLen] = name[:len(name)-8]
		resultLen++
	}

	return result[:resultLen], nil
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

// cleanOutput transforms the supplied output so that it no longer contains
// information that changes from run to run, making the golden tests less
// flaky.
func cleanOutput(o []byte, testPkg string) []byte {
	// Replace references to the last component of the test package name, which
	// contains a unique number.
	o = []byte(strings.Replace(string(o), path.Base(testPkg), "somepkg", -1))

	// Replace things that look like line numbers and process counters in stack
	// traces.
	stackFrameRe := regexp.MustCompile(`\t\S+\.(c|go):\d+`)
	o = stackFrameRe.ReplaceAll(o, []byte("\tsome_file.txt:0"))

	// Replace full paths in failure messages with fake paths.
	pathRe := regexp.MustCompile(`/\S+/(\w+\.go:\d+)`)
	o = pathRe.ReplaceAll(o, []byte("/some/path/$1"))

	// Replace unstable timings in gotest fail messages.
	timingRe1 := regexp.MustCompile(`--- FAIL: .* \(\d\.\d{2}s\)`)
	o = timingRe1.ReplaceAll(o, []byte("--- FAIL: TestSomething (1.23s)"))

	timingRe2 := regexp.MustCompile(`FAIL.*somepkg\s*\d\.\d{2,}s`)
	o = timingRe2.ReplaceAll(o, []byte("FAIL somepkg 1.234s"))

	timingRe3 := regexp.MustCompile(`ok.*somepkg\s*\d\.\d{2,}s`)
	o = timingRe3.ReplaceAll(o, []byte("ok somepkg 1.234s"))

	timingRe4 := regexp.MustCompile(`SlowTest \([0-9.]+ms\)`)
	o = timingRe4.ReplaceAll(o, []byte("SlowTest (1234ms)"))

	return o
}

// Create a temporary package directory somewhere that 'go test' can find, and
// return the directory and package name.
func createTempPackageDir(caseName string) (dir, pkg string) {
	// Figure out where the local source code for ogletest is.
	buildPkg, err := build.Import(ogletestPkg, "", build.FindOnly)
	if err != nil {
		panic("Finding ogletest tree: " + err.Error())
	}

	// Create a temporary directory underneath this.
	ogletestPkgDir := buildPkg.Dir
	prefix := fmt.Sprintf("tmp-%s-", caseName)

	dir, err = ioutil.TempDir(ogletestPkgDir, prefix)
	if err != nil {
		panic("ioutil.TempDir: " + err.Error())
	}

	pkg = path.Join("github.com/smartystreets/assertions/internal/ogletest", dir[len(ogletestPkgDir):])
	return
}

// runTestCase runs the case with the supplied name (e.g. "passing"), and
// returns its output and exit code.
func runTestCase(name string) ([]byte, int, error) {
	// Create a temporary directory for the test files.
	testDir, testPkg := createTempPackageDir(name)
	defer os.RemoveAll(testDir)

	// Create the test source file.
	sourceFile := name + ".test.go"
	testContents := readFileOrDie(path.Join("test_cases", sourceFile))
	writeContentsToFileOrDie(testContents, path.Join(testDir, name+"_test.go"))

	// Invoke 'go test'. Use the package directory as working dir instead of
	// giving the package name as an argument so that 'go test' prints passing
	// test output. Special case: pass a test filter to the filtered case.
	cmd := exec.Command("go", "test")
	if name == "filtered" {
		cmd.Args = append(cmd.Args, "--ogletest.run=Test(Bar|Baz)")
	}

	cmd.Dir = testDir
	output, err := cmd.CombinedOutput()

	// Clean up the process's output.
	output = cleanOutput(output, testPkg)

	// Did the process exist with zero code?
	if err == nil {
		return output, 0, nil
	}

	// Make sure the process actually exited.
	exitError, ok := err.(*exec.ExitError)
	if !ok || !exitError.Exited() {
		return nil, 0, errors.New("exec.Command.Output: " + err.Error())
	}

	return output, exitError.Sys().(syscall.WaitStatus).ExitStatus(), nil
}

// checkGolden file checks the supplied actual output for the named test case
// against the golden file for that case. If requested by the user, it rewrites
// the golden file on failure.
func checkAgainstGoldenFile(caseName string, output []byte) bool {
	goldenFile := path.Join("test_cases", "golden."+caseName+"_test")
	goldenContents := readFileOrDie(goldenFile)

	result := string(output) == string(goldenContents)
	if !result && *dumpNew {
		writeContentsToFileOrDie(output, goldenFile)
	}

	return result
}

////////////////////////////////////////////////////////////////////////
// Tests
////////////////////////////////////////////////////////////////////////

func TestGoldenFiles(t *testing.T) {
	// Ensure the local package is installed. This will prevent the test cases
	// from using the installed version, which may be out of date.
	err := installLocalPackages()
	if err != nil {
		t.Fatalf("Error installing local ogletest: %v", err)
	}

	// We expect there to be at least one case.
	caseNames, err := getCaseNames()
	if err != nil || len(caseNames) == 0 {
		t.Fatalf("Error getting cases: %v", err)
	}

	// Run each test case.
	for _, caseName := range caseNames {
		// Run the test case.
		output, exitCode, err := runTestCase(caseName)
		if err != nil {
			t.Fatalf("Running test case %s: %v", caseName, err)
		}

		// Check the status code. We assume all test cases fail except for the
		// passing one.
		shouldPass := (caseName == "passing" || caseName == "no_cases")
		didPass := exitCode == 0
		if shouldPass != didPass {
			t.Errorf("Bad exit code for test case %s: %d", caseName, exitCode)
		}

		// Check the output against the golden file.
		if !checkAgainstGoldenFile(caseName, output) {
			t.Errorf("Output for test case %s doesn't match golden file.", caseName)
		}
	}
}
