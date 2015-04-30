// Copyright 2012 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
Package interp implements image interpolation.

An interpolator provides the Interp interface, which can be used
to interpolate a pixel:

  c := interp.Bilinear.Interp(src, 1.2, 1.8)

To interpolate a large number of RGBA or Gray pixels, an implementation
may provide a fast-path by implementing the RGBA or Gray interfaces.

	i1, ok := i.(interp.RGBA)
	if ok {
		c := i1.RGBA(src, 1.2, 1.8)
		// use c.R, c.G, etc
		return
	}
	c := i.Interp(src, 1.2, 1.8)
	// use generic color.Color
*/
package interp
