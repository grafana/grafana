// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package graphics

import (
	"bosun.org/_third_party/code.google.com/p/graphics-go/graphics/graphicstest"
	"bytes"
	"image"
	"image/color"
	"testing"
)

type transformOneColorTest struct {
	desc      string
	dstWidth  int
	dstHeight int
	srcWidth  int
	srcHeight int
	opt       interface{}
	src       []uint8
	res       []uint8
}

func (oc *transformOneColorTest) newSrc() *image.RGBA {
	b := image.Rect(0, 0, oc.srcWidth, oc.srcHeight)
	src := image.NewRGBA(b)
	i := 0
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			src.SetRGBA(x, y, color.RGBA{
				R: oc.src[i],
				G: oc.src[i],
				B: oc.src[i],
				A: oc.src[i],
			})
			i++
		}
	}
	return src
}

func (oc *transformOneColorTest) newDst() *image.RGBA {
	return image.NewRGBA(image.Rect(0, 0, oc.dstWidth, oc.dstHeight))
}

func checkTransformTest(t *testing.T, oc *transformOneColorTest, dst *image.RGBA) bool {
	for ch := 0; ch < 4; ch++ {
		i := 0
		res := make([]byte, len(oc.res))
		for y := 0; y < oc.dstHeight; y++ {
			for x := 0; x < oc.dstWidth; x++ {
				off := (y-dst.Rect.Min.Y)*dst.Stride + (x-dst.Rect.Min.X)*4
				res[i] = dst.Pix[off+ch]
				i++
			}
		}

		if !bytes.Equal(res, oc.res) {
			got := graphicstest.SprintBox(res, oc.dstWidth, oc.dstHeight)
			want := graphicstest.SprintBox(oc.res, oc.dstWidth, oc.dstHeight)
			t.Errorf("%s: ch=%d\n got\n%s\n want\n%s", oc.desc, ch, got, want)
			return false
		}
	}

	return true
}
