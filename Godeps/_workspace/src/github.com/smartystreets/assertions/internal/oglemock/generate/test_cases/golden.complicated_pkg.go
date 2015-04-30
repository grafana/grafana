// This file was auto-generated using createmock. See the following page for
// more information:
//
//     https://github.com/smartystreets/assertions/internal/oglemock
//

package some_pkg

import (
	fmt "fmt"
	image "image"
	io "io"
	net "net"
	runtime "runtime"
	unsafe "unsafe"

	oglemock "github.com/smartystreets/assertions/internal/oglemock"
	complicated_pkg "github.com/smartystreets/assertions/internal/oglemock/generate/test_cases/complicated_pkg"
	tony "github.com/smartystreets/assertions/internal/oglemock/generate/test_cases/renamed_pkg"
)

type MockComplicatedThing interface {
	complicated_pkg.ComplicatedThing
	oglemock.MockObject
}

type mockComplicatedThing struct {
	controller  oglemock.Controller
	description string
}

func NewMockComplicatedThing(
	c oglemock.Controller,
	desc string) MockComplicatedThing {
	return &mockComplicatedThing{
		controller:  c,
		description: desc,
	}
}

func (m *mockComplicatedThing) Oglemock_Id() uintptr {
	return uintptr(unsafe.Pointer(m))
}

func (m *mockComplicatedThing) Oglemock_Description() string {
	return m.description
}

func (m *mockComplicatedThing) Arrays(p0 [3]string) (o0 [3]int, o1 error) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"Arrays",
		file,
		line,
		[]interface{}{p0})

	if len(retVals) != 2 {
		panic(fmt.Sprintf("mockComplicatedThing.Arrays: invalid return values: %v", retVals))
	}

	// o0 [3]int
	if retVals[0] != nil {
		o0 = retVals[0].([3]int)
	}

	// o1 error
	if retVals[1] != nil {
		o1 = retVals[1].(error)
	}

	return
}

func (m *mockComplicatedThing) Channels(p0 chan chan<- <-chan net.Conn) (o0 chan int) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"Channels",
		file,
		line,
		[]interface{}{p0})

	if len(retVals) != 1 {
		panic(fmt.Sprintf("mockComplicatedThing.Channels: invalid return values: %v", retVals))
	}

	// o0 chan int
	if retVals[0] != nil {
		o0 = retVals[0].(chan int)
	}

	return
}

func (m *mockComplicatedThing) EmptyInterface(p0 interface{}) (o0 interface{}, o1 error) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"EmptyInterface",
		file,
		line,
		[]interface{}{p0})

	if len(retVals) != 2 {
		panic(fmt.Sprintf("mockComplicatedThing.EmptyInterface: invalid return values: %v", retVals))
	}

	// o0 interface {}
	if retVals[0] != nil {
		o0 = retVals[0].(interface{})
	}

	// o1 error
	if retVals[1] != nil {
		o1 = retVals[1].(error)
	}

	return
}

func (m *mockComplicatedThing) Functions(p0 func(int, image.Image) int) (o0 func(string, int) net.Conn) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"Functions",
		file,
		line,
		[]interface{}{p0})

	if len(retVals) != 1 {
		panic(fmt.Sprintf("mockComplicatedThing.Functions: invalid return values: %v", retVals))
	}

	// o0 func(string, int) net.Conn
	if retVals[0] != nil {
		o0 = retVals[0].(func(string, int) net.Conn)
	}

	return
}

func (m *mockComplicatedThing) Maps(p0 map[string]*int) (o0 map[int]*string, o1 error) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"Maps",
		file,
		line,
		[]interface{}{p0})

	if len(retVals) != 2 {
		panic(fmt.Sprintf("mockComplicatedThing.Maps: invalid return values: %v", retVals))
	}

	// o0 map[int]*string
	if retVals[0] != nil {
		o0 = retVals[0].(map[int]*string)
	}

	// o1 error
	if retVals[1] != nil {
		o1 = retVals[1].(error)
	}

	return
}

func (m *mockComplicatedThing) NamedScalarType(p0 complicated_pkg.Byte) (o0 []complicated_pkg.Byte, o1 error) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"NamedScalarType",
		file,
		line,
		[]interface{}{p0})

	if len(retVals) != 2 {
		panic(fmt.Sprintf("mockComplicatedThing.NamedScalarType: invalid return values: %v", retVals))
	}

	// o0 []complicated_pkg.Byte
	if retVals[0] != nil {
		o0 = retVals[0].([]complicated_pkg.Byte)
	}

	// o1 error
	if retVals[1] != nil {
		o1 = retVals[1].(error)
	}

	return
}

func (m *mockComplicatedThing) Pointers(p0 *int, p1 *net.Conn, p2 **io.Reader) (o0 *int, o1 error) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"Pointers",
		file,
		line,
		[]interface{}{p0, p1, p2})

	if len(retVals) != 2 {
		panic(fmt.Sprintf("mockComplicatedThing.Pointers: invalid return values: %v", retVals))
	}

	// o0 *int
	if retVals[0] != nil {
		o0 = retVals[0].(*int)
	}

	// o1 error
	if retVals[1] != nil {
		o1 = retVals[1].(error)
	}

	return
}

func (m *mockComplicatedThing) RenamedPackage(p0 tony.SomeUint8Alias) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"RenamedPackage",
		file,
		line,
		[]interface{}{p0})

	if len(retVals) != 0 {
		panic(fmt.Sprintf("mockComplicatedThing.RenamedPackage: invalid return values: %v", retVals))
	}

	return
}

func (m *mockComplicatedThing) Slices(p0 []string) (o0 []int, o1 error) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"Slices",
		file,
		line,
		[]interface{}{p0})

	if len(retVals) != 2 {
		panic(fmt.Sprintf("mockComplicatedThing.Slices: invalid return values: %v", retVals))
	}

	// o0 []int
	if retVals[0] != nil {
		o0 = retVals[0].([]int)
	}

	// o1 error
	if retVals[1] != nil {
		o1 = retVals[1].(error)
	}

	return
}

func (m *mockComplicatedThing) Variadic(p0 int, p1 ...net.Conn) (o0 int) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"Variadic",
		file,
		line,
		[]interface{}{p0, p1})

	if len(retVals) != 1 {
		panic(fmt.Sprintf("mockComplicatedThing.Variadic: invalid return values: %v", retVals))
	}

	// o0 int
	if retVals[0] != nil {
		o0 = retVals[0].(int)
	}

	return
}
