// This file was auto-generated using createmock. See the following page for
// more information:
//
//     https://github.com/smartystreets/assertions/internal/oglemock
//

package mock_image

import (
	fmt "fmt"
	oglemock "github.com/smartystreets/assertions/internal/oglemock"
	image "image"
	color "image/color"
	runtime "runtime"
	unsafe "unsafe"
)

type MockImage interface {
	image.Image
	oglemock.MockObject
}

type mockImage struct {
	controller  oglemock.Controller
	description string
}

func NewMockImage(
	c oglemock.Controller,
	desc string) MockImage {
	return &mockImage{
		controller:  c,
		description: desc,
	}
}

func (m *mockImage) Oglemock_Id() uintptr {
	return uintptr(unsafe.Pointer(m))
}

func (m *mockImage) Oglemock_Description() string {
	return m.description
}

func (m *mockImage) At(p0 int, p1 int) (o0 color.Color) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"At",
		file,
		line,
		[]interface{}{p0, p1})

	if len(retVals) != 1 {
		panic(fmt.Sprintf("mockImage.At: invalid return values: %v", retVals))
	}

	// o0 color.Color
	if retVals[0] != nil {
		o0 = retVals[0].(color.Color)
	}

	return
}

func (m *mockImage) Bounds() (o0 image.Rectangle) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"Bounds",
		file,
		line,
		[]interface{}{})

	if len(retVals) != 1 {
		panic(fmt.Sprintf("mockImage.Bounds: invalid return values: %v", retVals))
	}

	// o0 image.Rectangle
	if retVals[0] != nil {
		o0 = retVals[0].(image.Rectangle)
	}

	return
}

func (m *mockImage) ColorModel() (o0 color.Model) {
	// Get a file name and line number for the caller.
	_, file, line, _ := runtime.Caller(1)

	// Hand the call off to the controller, which does most of the work.
	retVals := m.controller.HandleMethodCall(
		m,
		"ColorModel",
		file,
		line,
		[]interface{}{})

	if len(retVals) != 1 {
		panic(fmt.Sprintf("mockImage.ColorModel: invalid return values: %v", retVals))
	}

	// o0 color.Model
	if retVals[0] != nil {
		o0 = retVals[0].(color.Model)
	}

	return
}
