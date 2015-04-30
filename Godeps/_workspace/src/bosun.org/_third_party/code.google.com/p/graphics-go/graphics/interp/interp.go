// Copyright 2012 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package interp

import (
	"image"
	"image/color"
)

// Interp interpolates an image's color at fractional co-ordinates.
type Interp interface {
	// Interp interpolates (x, y).
	Interp(src image.Image, x, y float64) color.Color
}

// RGBA is a fast-path interpolation implementation for image.RGBA.
// It is common for an Interp to also implement RGBA.
type RGBA interface {
	// RGBA interpolates (x, y).
	RGBA(src *image.RGBA, x, y float64) color.RGBA
}

// Gray is a fast-path interpolation implementation for image.Gray.
type Gray interface {
	// Gray interpolates (x, y).
	Gray(src *image.Gray, x, y float64) color.Gray
}
