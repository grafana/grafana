// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package graphics

import (
	"bosun.org/_third_party/code.google.com/p/graphics-go/graphics/graphicstest"
	"image"
	"testing"

	_ "image/png"
)

var scaleOneColorTests = []transformOneColorTest{
	{
		"down-half",
		1, 1,
		2, 2,
		nil,
		[]uint8{
			0x80, 0x00,
			0x00, 0x80,
		},
		[]uint8{
			0x40,
		},
	},
	{
		"up-double",
		4, 4,
		2, 2,
		nil,
		[]uint8{
			0x80, 0x00,
			0x00, 0x80,
		},
		[]uint8{
			0x80, 0x60, 0x20, 0x00,
			0x60, 0x50, 0x30, 0x20,
			0x20, 0x30, 0x50, 0x60,
			0x00, 0x20, 0x60, 0x80,
		},
	},
	{
		"up-doublewidth",
		4, 2,
		2, 2,
		nil,
		[]uint8{
			0x80, 0x00,
			0x00, 0x80,
		},
		[]uint8{
			0x80, 0x60, 0x20, 0x00,
			0x00, 0x20, 0x60, 0x80,
		},
	},
	{
		"up-doubleheight",
		2, 4,
		2, 2,
		nil,
		[]uint8{
			0x80, 0x00,
			0x00, 0x80,
		},
		[]uint8{
			0x80, 0x00,
			0x60, 0x20,
			0x20, 0x60,
			0x00, 0x80,
		},
	},
	{
		"up-partial",
		3, 3,
		2, 2,
		nil,
		[]uint8{
			0x80, 0x00,
			0x00, 0x80,
		},
		[]uint8{
			0x80, 0x40, 0x00,
			0x40, 0x40, 0x40,
			0x00, 0x40, 0x80,
		},
	},
}

func TestScaleOneColor(t *testing.T) {
	for _, oc := range scaleOneColorTests {
		dst := oc.newDst()
		src := oc.newSrc()
		if err := Scale(dst, src); err != nil {
			t.Errorf("scale %s: %v", oc.desc, err)
			continue
		}

		if !checkTransformTest(t, &oc, dst) {
			continue
		}
	}
}

func TestScaleEmpty(t *testing.T) {
	empty := image.NewRGBA(image.Rect(0, 0, 0, 0))
	if err := Scale(empty, empty); err != nil {
		t.Fatal(err)
	}
}

func TestScaleGopher(t *testing.T) {
	dst := image.NewRGBA(image.Rect(0, 0, 100, 150))

	src, err := graphicstest.LoadImage("../testdata/gopher.png")
	if err != nil {
		t.Error(err)
		return
	}

	// Down-sample.
	if err := Scale(dst, src); err != nil {
		t.Fatal(err)
	}
	cmp, err := graphicstest.LoadImage("../testdata/gopher-100x150.png")
	if err != nil {
		t.Error(err)
		return
	}
	err = graphicstest.ImageWithinTolerance(dst, cmp, 0)
	if err != nil {
		t.Error(err)
		return
	}

	// Up-sample.
	dst = image.NewRGBA(image.Rect(0, 0, 500, 750))
	if err := Scale(dst, src); err != nil {
		t.Fatal(err)
	}
	cmp, err = graphicstest.LoadImage("../testdata/gopher-500x750.png")
	if err != nil {
		t.Error(err)
		return
	}
	err = graphicstest.ImageWithinTolerance(dst, cmp, 0)
	if err != nil {
		t.Error(err)
		return
	}
}
