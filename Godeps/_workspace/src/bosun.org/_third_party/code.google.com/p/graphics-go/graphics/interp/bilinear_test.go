// Copyright 2012 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package interp

import (
	"image"
	"image/color"
	"testing"
)

type interpTest struct {
	desc     string
	src      []uint8
	srcWidth int
	x, y     float64
	expect   uint8
}

func (p *interpTest) newSrc() *image.RGBA {
	b := image.Rect(0, 0, p.srcWidth, len(p.src)/p.srcWidth)
	src := image.NewRGBA(b)
	i := 0
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			src.SetRGBA(x, y, color.RGBA{
				R: p.src[i],
				G: p.src[i],
				B: p.src[i],
				A: 0xff,
			})
			i++
		}
	}
	return src
}

var interpTests = []interpTest{
	{
		desc:     "center of a single white pixel should match that pixel",
		src:      []uint8{0x00},
		srcWidth: 1,
		x:        0.5,
		y:        0.5,
		expect:   0x00,
	},
	{
		desc: "middle of a square is equally weighted",
		src: []uint8{
			0x00, 0xff,
			0xff, 0x00,
		},
		srcWidth: 2,
		x:        1.0,
		y:        1.0,
		expect:   0x80,
	},
	{
		desc: "center of a pixel is just that pixel",
		src: []uint8{
			0x00, 0xff,
			0xff, 0x00,
		},
		srcWidth: 2,
		x:        1.5,
		y:        0.5,
		expect:   0xff,
	},
	{
		desc: "asymmetry abounds",
		src: []uint8{
			0xaa, 0x11, 0x55,
			0xff, 0x95, 0xdd,
		},
		srcWidth: 3,
		x:        2.0,
		y:        1.0,
		expect:   0x76, // (0x11 + 0x55 + 0x95 + 0xdd) / 4
	},
}

func TestBilinearRGBA(t *testing.T) {
	for _, p := range interpTests {
		src := p.newSrc()

		// Fast path.
		c := Bilinear.(RGBA).RGBA(src, p.x, p.y)
		if c.R != c.G || c.R != c.B || c.A != 0xff {
			t.Errorf("expect channels to match, got %v", c)
			continue
		}
		if c.R != p.expect {
			t.Errorf("%s: got 0x%02x want 0x%02x", p.desc, c.R, p.expect)
			continue
		}

		// Standard Interp should use the fast path.
		cStd := Bilinear.Interp(src, p.x, p.y)
		if cStd != c {
			t.Errorf("%s: standard mismatch got %v want %v", p.desc, cStd, c)
			continue
		}

		// General case should match the fast path.
		cGen := color.RGBAModel.Convert(bilinearGeneral(src, p.x, p.y))
		r0, g0, b0, a0 := c.RGBA()
		r1, g1, b1, a1 := cGen.RGBA()
		if r0 != r1 || g0 != g1 || b0 != b1 || a0 != a1 {
			t.Errorf("%s: general case mismatch got %v want %v", p.desc, c, cGen)
			continue
		}
	}
}

func TestBilinearSubImage(t *testing.T) {
	b0 := image.Rect(0, 0, 4, 4)
	src0 := image.NewRGBA(b0)
	b1 := image.Rect(1, 1, 3, 3)
	src1 := src0.SubImage(b1).(*image.RGBA)
	src1.Set(1, 1, color.RGBA{0x11, 0, 0, 0xff})
	src1.Set(2, 1, color.RGBA{0x22, 0, 0, 0xff})
	src1.Set(1, 2, color.RGBA{0x33, 0, 0, 0xff})
	src1.Set(2, 2, color.RGBA{0x44, 0, 0, 0xff})

	tests := []struct {
		x, y float64
		want uint8
	}{
		{1, 1, 0x11},
		{3, 1, 0x22},
		{1, 3, 0x33},
		{3, 3, 0x44},
		{2, 2, 0x2b},
	}

	for _, p := range tests {
		c := Bilinear.(RGBA).RGBA(src1, p.x, p.y)
		if c.R != p.want {
			t.Errorf("(%.0f, %.0f): got 0x%02x want 0x%02x", p.x, p.y, c.R, p.want)
		}
	}
}
