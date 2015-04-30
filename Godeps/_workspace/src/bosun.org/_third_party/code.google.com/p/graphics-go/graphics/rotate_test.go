// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package graphics

import (
	"bosun.org/_third_party/code.google.com/p/graphics-go/graphics/graphicstest"
	"image"
	"math"
	"testing"

	_ "image/png"
)

var rotateOneColorTests = []transformOneColorTest{
	{
		"onepixel-onequarter", 1, 1, 1, 1,
		&RotateOptions{math.Pi / 2},
		[]uint8{0xff},
		[]uint8{0xff},
	},
	{
		"onepixel-partial", 1, 1, 1, 1,
		&RotateOptions{math.Pi * 2.0 / 3.0},
		[]uint8{0xff},
		[]uint8{0xff},
	},
	{
		"onepixel-complete", 1, 1, 1, 1,
		&RotateOptions{2 * math.Pi},
		[]uint8{0xff},
		[]uint8{0xff},
	},
	{
		"even-onequarter", 2, 2, 2, 2,
		&RotateOptions{math.Pi / 2.0},
		[]uint8{
			0xff, 0x00,
			0x00, 0xff,
		},
		[]uint8{
			0x00, 0xff,
			0xff, 0x00,
		},
	},
	{
		"even-complete", 2, 2, 2, 2,
		&RotateOptions{2.0 * math.Pi},
		[]uint8{
			0xff, 0x00,
			0x00, 0xff,
		},
		[]uint8{
			0xff, 0x00,
			0x00, 0xff,
		},
	},
	{
		"line-partial", 3, 3, 3, 3,
		&RotateOptions{math.Pi * 1.0 / 3.0},
		[]uint8{
			0x00, 0x00, 0x00,
			0xff, 0xff, 0xff,
			0x00, 0x00, 0x00,
		},
		[]uint8{
			0xa2, 0x80, 0x00,
			0x22, 0xff, 0x22,
			0x00, 0x80, 0xa2,
		},
	},
	{
		"line-offset-partial", 3, 3, 3, 3,
		&RotateOptions{math.Pi * 3 / 2},
		[]uint8{
			0x00, 0x00, 0x00,
			0x00, 0xff, 0xff,
			0x00, 0x00, 0x00,
		},
		[]uint8{
			0x00, 0xff, 0x00,
			0x00, 0xff, 0x00,
			0x00, 0x00, 0x00,
		},
	},
	{
		"dot-partial", 4, 4, 4, 4,
		&RotateOptions{math.Pi},
		[]uint8{
			0x00, 0x00, 0x00, 0x00,
			0x00, 0xff, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
		},
		[]uint8{
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0xff, 0x00,
			0x00, 0x00, 0x00, 0x00,
		},
	},
}

func TestRotateOneColor(t *testing.T) {
	for _, oc := range rotateOneColorTests {
		src := oc.newSrc()
		dst := oc.newDst()

		if err := Rotate(dst, src, oc.opt.(*RotateOptions)); err != nil {
			t.Errorf("rotate %s: %v", oc.desc, err)
			continue
		}
		if !checkTransformTest(t, &oc, dst) {
			continue
		}
	}
}

func TestRotateEmpty(t *testing.T) {
	empty := image.NewRGBA(image.Rect(0, 0, 0, 0))
	if err := Rotate(empty, empty, nil); err != nil {
		t.Fatal(err)
	}
}

func TestRotateGopherSide(t *testing.T) {
	src, err := graphicstest.LoadImage("../testdata/gopher.png")
	if err != nil {
		t.Fatal(err)
	}

	srcb := src.Bounds()
	dst := image.NewRGBA(image.Rect(0, 0, srcb.Dy(), srcb.Dx()))
	if err := Rotate(dst, src, &RotateOptions{math.Pi / 2.0}); err != nil {
		t.Fatal(err)
	}

	cmp, err := graphicstest.LoadImage("../testdata/gopher-rotate-side.png")
	if err != nil {
		t.Fatal(err)
	}
	err = graphicstest.ImageWithinTolerance(dst, cmp, 0x101)
	if err != nil {
		t.Fatal(err)
	}
}

func TestRotateGopherPartial(t *testing.T) {
	src, err := graphicstest.LoadImage("../testdata/gopher.png")
	if err != nil {
		t.Fatal(err)
	}

	srcb := src.Bounds()
	dst := image.NewRGBA(image.Rect(0, 0, srcb.Dx(), srcb.Dy()))
	if err := Rotate(dst, src, &RotateOptions{math.Pi / 3.0}); err != nil {
		t.Fatal(err)
	}

	cmp, err := graphicstest.LoadImage("../testdata/gopher-rotate-partial.png")
	if err != nil {
		t.Fatal(err)
	}
	err = graphicstest.ImageWithinTolerance(dst, cmp, 0x101)
	if err != nil {
		t.Fatal(err)
	}
}
