package testutil

import (
	"embed"
	"testing"
	"time"
)

//go:embed data/*
var dataFS embed.FS

//go:generate mockery --with-expecter --name T

// T provides a clean way to test the utilities of this package.
type T interface {
	Helper()
	Cleanup(func())
	Deadline() (time.Time, bool)
	Errorf(format string, args ...any)
	FailNow()
}

func init() {
	// At the moment of this writing, there is already testing code imported in
	// server runtime code. Please, consider refactoring your code to keep
	// runtime dependencies clean.
	if !testing.Testing() {
		panic("importing testing libraries in runtime code is not allowed")
	}
}
