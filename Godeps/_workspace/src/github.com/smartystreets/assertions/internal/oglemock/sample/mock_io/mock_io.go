// This file was auto-generated using createmock. See the following page for
// more information:
//
//     https://github.com/smartystreets/assertions/internal/oglemock
//

package mock_io

import (
	fmt "fmt"
	io "io"
	runtime "runtime"
	unsafe "unsafe"

	oglemock "github.com/smartystreets/assertions/internal/oglemock"
)

type MockReader interface {
	io.Reader
	oglemock.MockObject
}

type mockReader struct {
	controller  oglemock.Controller
	description string
}

func NewMockReader(
	c oglemock.Controller,
	desc string) MockReader {
	return &mockReader{
		controller:  c,
		description: desc,
	}
}

func (m *mockReader) Oglemock_Id() uintptr {
	return uintptr(unsafe.Pointer(m))
}

func (m *mockReader) Oglemock_Description() string {
	return m.description
}

func (m *mockReader) Read(p0 []uint8) (o0 int, o1 error) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"Read",
		file,
		line,
		[]interface{}{p0})

	if len(retVals) != 2 {
		panic(fmt.Sprintf("mockReader.Read: invalid return values: %v", retVals))
	}

	// o0 int
	if retVals[0] != nil {
		o0 = retVals[0].(int)
	}

	// o1 error
	if retVals[1] != nil {
		o1 = retVals[1].(error)
	}

	return
}
