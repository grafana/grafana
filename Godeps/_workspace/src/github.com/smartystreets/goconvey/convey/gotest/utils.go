// Package gotest contains internal functionality. Although this package
// contains one or more exported names it is not intended for public
// consumption. See the examples package for how to use this project.
package gotest

import (
	"fmt"
	"runtime"
	"strings"
)

func FormatExternalFileAndLine() string {
	file, line, _ := ResolveExternalCaller()
	if line == -1 {
		return "<unknown caller!>" // panic?
	}
	return fmt.Sprintf("%s:%d", file, line)
}

func ResolveExternalCaller() (file string, line int, name string) {
	var caller_id uintptr
	callers := runtime.Callers(0, callStack)

	for x := 0; x < callers; x++ {
		caller_id, file, line, _ = runtime.Caller(x)
		if strings.HasSuffix(file, "_test.go") {
			name = runtime.FuncForPC(caller_id).Name()
			return
		}
	}
	file, line, name = "<unkown file>", -1, "<unknown name>"
	return // panic?
}

const maxStackDepth = 100 // This had better be enough...

var callStack []uintptr = make([]uintptr, maxStackDepth, maxStackDepth)
