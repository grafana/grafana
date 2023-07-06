package main

import (
	"bytes"
	"log"
	"strings"
	"testing"
	"testing/fstest"
)

func TestCommonElement(t *testing.T) {
	for _, test := range []struct {
		A      []string
		B      []string
		Result bool
	}{
		{nil, nil, false},
		{[]string{"a"}, []string{"a"}, true},
		{[]string{"a", "b"}, []string{"a"}, true},
		{[]string{"a"}, []string{"b"}, false},
	} {
		if hasCommonElement(test.A, test.B) != test.Result {
			t.Error(test)
		}
	}
}

func TestCheck(t *testing.T) {
	for _, test := range []struct {
		description    string
		fileName       string
		contents       string
		args           []string
		valid          bool
		expectedOutput string
	}{
		{"Test valid modfile", "go.mod", `
		require (
			cloud.google.com/go/storage v1.28.1 // @delivery
			cuelang.org/go v0.5.0 // @as-code @backend-platform
			github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @delivery
			github.com/Masterminds/semver v1.5.0 // @delivery @backend-platform
		)
		`, []string{"go.mod"}, true, ""},
		{"Test invalid modfile", "go.mod", `
		require (
			cloud.google.com/go/storage v1.28.1
			cuelang.org/go v0.5.0 // @as-code @backend-platform
			github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @delivery
			github.com/Masterminds/semver v1.5.0 // @delivery @backend-platform
		)
		`, []string{"go.mod"}, false, "cloud.google.com/go/storage@v1.28.1\n"},
	} {
		buf := &bytes.Buffer{}
		logger := log.New(buf, "", 0)
		filesystem := fstest.MapFS{test.fileName: &fstest.MapFile{Data: []byte(test.contents)}}
		err := check(filesystem, logger, test.args)
		if test.valid && err != nil {
			t.Error(test.description, err)
		} else if !test.valid && err == nil {
			t.Error(test.description, "error expected")
		}
		if buf.String() != test.expectedOutput {
			t.Error(test.description, buf.String())
		}
	}
}

func TestModules(t *testing.T) {
	buf := &bytes.Buffer{}
	logger := log.New(buf, "", 0)
	filesystem := fstest.MapFS{"go.txd": &fstest.MapFile{Data: []byte(`
	require (
		cloud.google.com/go/storage v1.28.1
		cuelang.org/go v0.5.0 // @as-code @backend-platform
		github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @delivery
		github.com/Masterminds/semver v1.5.0 // @delivery @backend-platform
	)
	`)}}

	err := modules(filesystem, logger, []string{"-m", "go.txd"}) // NOTE: pass various flags, these are cmd line arguments
	if err != nil {
		t.Error(err, buf.String())
	}

	logs := buf.String()

	// Expected results
	expectedModules := []string{
		"cloud.google.com/go/storage v1.28.1",
		"cuelang.org/go v0.5.0",
		"github.com/Azure/azure-sdk-for-go v65.0.0+incompatible",
		"github.com/Masterminds/semver v1.5.0",
	}

	expectedResults := strings.Join(expectedModules, "\n")

	// Compare logs to expected results
	if logs != expectedResults {
		t.Error(err)
	}
}
