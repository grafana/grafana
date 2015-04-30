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

func TestThumbnailGopher(t *testing.T) {
	dst := image.NewRGBA(image.Rect(0, 0, 80, 80))

	src, err := graphicstest.LoadImage("../testdata/gopher.png")
	if err != nil {
		t.Fatal(err)
	}
	if err := Thumbnail(dst, src); err != nil {
		t.Fatal(err)
	}
	cmp, err := graphicstest.LoadImage("../testdata/gopher-thumb-80x80.png")
	if err != nil {
		t.Fatal(err)
	}
	err = graphicstest.ImageWithinTolerance(dst, cmp, 0)
	if err != nil {
		t.Error(err)
	}
}

func TestThumbnailLongGopher(t *testing.T) {
	dst := image.NewRGBA(image.Rect(0, 0, 50, 150))

	src, err := graphicstest.LoadImage("../testdata/gopher.png")
	if err != nil {
		t.Fatal(err)
	}
	if err := Thumbnail(dst, src); err != nil {
		t.Fatal(err)
	}
	cmp, err := graphicstest.LoadImage("../testdata/gopher-thumb-50x150.png")
	if err != nil {
		t.Fatal(err)
	}
	err = graphicstest.ImageWithinTolerance(dst, cmp, 0)
	if err != nil {
		t.Error(err)
	}
}
