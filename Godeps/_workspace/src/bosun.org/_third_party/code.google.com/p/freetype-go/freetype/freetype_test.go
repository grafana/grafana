// Copyright 2012 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

package freetype

import (
	"image"
	"image/draw"
	"io/ioutil"
	"runtime"
	"strings"
	"testing"
)

func BenchmarkDrawString(b *testing.B) {
	data, err := ioutil.ReadFile("../licenses/gpl.txt")
	if err != nil {
		b.Fatal(err)
	}
	lines := strings.Split(string(data), "\n")

	data, err = ioutil.ReadFile("../testdata/luxisr.ttf")
	if err != nil {
		b.Fatal(err)
	}
	font, err := ParseFont(data)
	if err != nil {
		b.Fatal(err)
	}

	dst := image.NewRGBA(image.Rect(0, 0, 800, 600))
	draw.Draw(dst, dst.Bounds(), image.White, image.ZP, draw.Src)

	c := NewContext()
	c.SetDst(dst)
	c.SetClip(dst.Bounds())
	c.SetSrc(image.Black)
	c.SetFont(font)

	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	mallocs := ms.Mallocs

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for j, line := range lines {
			_, err := c.DrawString(line, Pt(0, (j*16)%600))
			if err != nil {
				b.Fatal(err)
			}
		}
	}
	b.StopTimer()
	runtime.ReadMemStats(&ms)
	mallocs = ms.Mallocs - mallocs
	b.Logf("%d iterations, %d mallocs per iteration\n", b.N, int(mallocs)/b.N)
}
