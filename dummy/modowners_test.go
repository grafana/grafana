package main

import (
	"bytes"
	"fmt"
	"github.com/stretchr/testify/assert"
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
	// Test case: all dependencies have an owner, check passes
	buf := &bytes.Buffer{}        // NOTE: empty buffer, growing list of bytes
	logger := log.New(buf, "", 0) // NOTE: uses buffer as writer, appends data to buffer
	filesystem := fstest.MapFS{"go.txd": &fstest.MapFile{Data: []byte(`
	require (
		cloud.google.com/go/storage v1.28.1 // @delivery
		cuelang.org/go v0.5.0 // @as-code @backend-platform
		github.com/Azure/azure-sdk-for-go v65.0.0+incompatible // indirect, @delivery
		github.com/Masterminds/semver v1.5.0 // @delivery @backend-platform
	)
	`)}}
	err := check(filesystem, logger, []string{"go.txd"})
	if err != nil {
		t.Error(err, buf.String()) // NOTE: print output of check cmd
	}
}

func TestModules(t *testing.T) {
	// Test case: no flags, print all direct dependencies
	// logger := log.New(os.Stderr, "", log.LstdFlags)
	// buf := &bytes.Buffer{}
	// mockLogger := log.New(buf, "", log.LstdFlags)
	// logger = mocks.mockLogger

	buf := &bytes.Buffer{}
	logger := log.New(buf, "", 0)
	fmt.Println("LOGGER HERE", logger)
	logs := strings.Split(buf.String(), "\n")
	fmt.Println("LOGS HERE", logs)

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
		t.Error(err, buf.String()) // NOTE: print output of check cmd
	}

	// Expected results
	expectedResults := []string{
		"cloud.google.com/go/storage v1.28.1",
		"cuelang.org/go v0.5.0",
		"github.com/Azure/azure-sdk-for-go v65.0.0+incompatible",
		"github.com/Masterminds/semver v1.5.0",
	}

	// Compare expected results to actual logs
	for _, module := range expectedResults {
		assert.Contains(t, logs, module)
	}
}
