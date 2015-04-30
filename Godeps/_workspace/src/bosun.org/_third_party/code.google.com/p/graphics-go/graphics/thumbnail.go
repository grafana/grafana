// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package graphics

import (
	"image"
	"image/draw"
)

// Thumbnail scales and crops src so it fits in dst.
func Thumbnail(dst draw.Image, src image.Image) error {
	// Scale down src in the dimension that is closer to dst.
	sb := src.Bounds()
	db := dst.Bounds()
	rx := float64(sb.Dx()) / float64(db.Dx())
	ry := float64(sb.Dy()) / float64(db.Dy())
	var b image.Rectangle
	if rx < ry {
		b = image.Rect(0, 0, db.Dx(), int(float64(sb.Dy())/rx))
	} else {
		b = image.Rect(0, 0, int(float64(sb.Dx())/ry), db.Dy())
	}

	buf := image.NewRGBA(b)
	if err := Scale(buf, src); err != nil {
		return err
	}

	// Crop.
	// TODO(crawshaw): improve on center-alignment.
	var pt image.Point
	if rx < ry {
		pt.Y = (b.Dy() - db.Dy()) / 2
	} else {
		pt.X = (b.Dx() - db.Dx()) / 2
	}
	draw.Draw(dst, db, buf, pt, draw.Src)
	return nil
}
