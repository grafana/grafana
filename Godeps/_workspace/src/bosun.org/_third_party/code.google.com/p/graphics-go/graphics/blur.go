// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package graphics

import (
	"bosun.org/_third_party/code.google.com/p/graphics-go/graphics/convolve"
	"errors"
	"image"
	"image/draw"
	"math"
)

// DefaultStdDev is the default blurring parameter.
var DefaultStdDev = 0.5

// BlurOptions are the blurring parameters.
// StdDev is the standard deviation of the normal, higher is blurrier.
// Size is the size of the kernel. If zero, it is set to Ceil(6 * StdDev).
type BlurOptions struct {
	StdDev float64
	Size   int
}

// Blur produces a blurred version of the image, using a Gaussian blur.
func Blur(dst draw.Image, src image.Image, opt *BlurOptions) error {
	if dst == nil {
		return errors.New("graphics: dst is nil")
	}
	if src == nil {
		return errors.New("graphics: src is nil")
	}

	sd := DefaultStdDev
	size := 0

	if opt != nil {
		sd = opt.StdDev
		size = opt.Size
	}

	if size < 1 {
		size = int(math.Ceil(sd * 6))
	}

	kernel := make([]float64, 2*size+1)
	for i := 0; i <= size; i++ {
		x := float64(i) / sd
		x = math.Pow(1/math.SqrtE, x*x)
		kernel[size-i] = x
		kernel[size+i] = x
	}

	// Normalize the weights to sum to 1.0.
	kSum := 0.0
	for _, k := range kernel {
		kSum += k
	}
	for i, k := range kernel {
		kernel[i] = k / kSum
	}

	return convolve.Convolve(dst, src, &convolve.SeparableKernel{
		X: kernel,
		Y: kernel,
	})
}
