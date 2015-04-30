package chart

import (
	"fmt"
	"image/color"
	"testing"
)

func TestRgb2Hsv(t *testing.T) {
	type rgbhsv struct{ r, g, b, h, s, v int }
	r2h := []rgbhsv{{255, 0, 0, 0, 100, 100}, {0, 128, 0, 120, 100, 50}, {255, 255, 0, 60, 100, 100},
		{255, 0, 255, 300, 100, 100}}
	for _, x := range r2h {
		h, s, v := rgb2hsv(x.r, x.g, x.b)
		if h != x.h || s != x.s || v != x.v {
			t.Errorf("Expected hsv=%d,%d,%d, got %d,%d,%d for rgb=%d,%d,%d", x.h, x.s, x.v, h, s, v, x.r, x.g, x.b)
		}
	}
}

func TestBrighten(t *testing.T) {
	c2t := func(c color.Color) string {
		r, g, b, _ := c.RGBA()
		return fmt.Sprintf("#%02x%02x%02x", r>>8, g>>8, b>>8)
	}

	for _, col := range []color.RGBA{{0xff, 0, 0, 0xff}, {0, 0xff, 0, 0xff}, {0, 0, 0xff, 0xff}} {
		for _, f := range []float64{0.1, 0.3, 0.5, 0.7, 0.9} {
			fmt.Printf("%s  --- %.2f -->  %s  %s\n",
				c2t(col), f, c2t(lighter(col, f)), c2t(darker(col, f)))
		}
	}
}
