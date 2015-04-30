// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package convolve

import (
	"errors"
	"fmt"
	"image"
	"image/draw"
	"math"
)

// clamp clamps x to the range [x0, x1].
func clamp(x, x0, x1 float64) float64 {
	if x < x0 {
		return x0
	}
	if x > x1 {
		return x1
	}
	return x
}

// Kernel is a square matrix that defines a convolution.
type Kernel interface {
	// Weights returns the square matrix of weights in row major order.
	Weights() []float64
}

// SeparableKernel is a linearly separable, square convolution kernel.
// X and Y are the per-axis weights. Each slice must be the same length, and
// have an odd length. The middle element of each slice is the weight for the
// central pixel. For example, the horizontal Sobel kernel is:
//	sobelX := &SeparableKernel{
//		X: []float64{-1, 0, +1},
//		Y: []float64{1, 2, 1},
//	}
type SeparableKernel struct {
	X, Y []float64
}

func (k *SeparableKernel) Weights() []float64 {
	n := len(k.X)
	w := make([]float64, n*n)
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			w[y*n+x] = k.X[x] * k.Y[y]
		}
	}
	return w
}

// fullKernel is a square convolution kernel.
type fullKernel []float64

func (k fullKernel) Weights() []float64 { return k }

func kernelSize(w []float64) (size int, err error) {
	size = int(math.Sqrt(float64(len(w))))
	if size*size != len(w) {
		return 0, errors.New("graphics: kernel is not square")
	}
	if size%2 != 1 {
		return 0, errors.New("graphics: kernel size is not odd")
	}
	return size, nil
}

// NewKernel returns a square convolution kernel.
func NewKernel(w []float64) (Kernel, error) {
	if _, err := kernelSize(w); err != nil {
		return nil, err
	}
	return fullKernel(w), nil
}

func convolveRGBASep(dst *image.RGBA, src image.Image, k *SeparableKernel) error {
	if len(k.X) != len(k.Y) {
		return fmt.Errorf("graphics: kernel not square (x %d, y %d)", len(k.X), len(k.Y))
	}
	if len(k.X)%2 != 1 {
		return fmt.Errorf("graphics: kernel length (%d) not odd", len(k.X))
	}
	radius := (len(k.X) - 1) / 2

	// buf holds the result of vertically blurring src.
	bounds := dst.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	buf := make([]float64, width*height*4)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			var r, g, b, a float64
			// k0 is the kernel weight for the center pixel. This may be greater
			// than kernel[0], near the boundary of the source image, to avoid
			// vignetting.
			k0 := k.X[radius]

			// Add the pixels from above.
			for i := 1; i <= radius; i++ {
				f := k.Y[radius-i]
				if y-i < bounds.Min.Y {
					k0 += f
				} else {
					or, og, ob, oa := src.At(x, y-i).RGBA()
					r += float64(or>>8) * f
					g += float64(og>>8) * f
					b += float64(ob>>8) * f
					a += float64(oa>>8) * f
				}
			}

			// Add the pixels from below.
			for i := 1; i <= radius; i++ {
				f := k.Y[radius+i]
				if y+i >= bounds.Max.Y {
					k0 += f
				} else {
					or, og, ob, oa := src.At(x, y+i).RGBA()
					r += float64(or>>8) * f
					g += float64(og>>8) * f
					b += float64(ob>>8) * f
					a += float64(oa>>8) * f
				}
			}

			// Add the central pixel.
			or, og, ob, oa := src.At(x, y).RGBA()
			r += float64(or>>8) * k0
			g += float64(og>>8) * k0
			b += float64(ob>>8) * k0
			a += float64(oa>>8) * k0

			// Write to buf.
			o := (y-bounds.Min.Y)*width*4 + (x-bounds.Min.X)*4
			buf[o+0] = r
			buf[o+1] = g
			buf[o+2] = b
			buf[o+3] = a
		}
	}

	// dst holds the result of horizontally blurring buf.
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			var r, g, b, a float64
			k0, off := k.X[radius], y*width*4+x*4

			// Add the pixels from the left.
			for i := 1; i <= radius; i++ {
				f := k.X[radius-i]
				if x-i < 0 {
					k0 += f
				} else {
					o := off - i*4
					r += buf[o+0] * f
					g += buf[o+1] * f
					b += buf[o+2] * f
					a += buf[o+3] * f
				}
			}

			// Add the pixels from the right.
			for i := 1; i <= radius; i++ {
				f := k.X[radius+i]
				if x+i >= width {
					k0 += f
				} else {
					o := off + i*4
					r += buf[o+0] * f
					g += buf[o+1] * f
					b += buf[o+2] * f
					a += buf[o+3] * f
				}
			}

			// Add the central pixel.
			r += buf[off+0] * k0
			g += buf[off+1] * k0
			b += buf[off+2] * k0
			a += buf[off+3] * k0

			// Write to dst, clamping to the range [0, 255].
			dstOff := (y-dst.Rect.Min.Y)*dst.Stride + (x-dst.Rect.Min.X)*4
			dst.Pix[dstOff+0] = uint8(clamp(r+0.5, 0, 255))
			dst.Pix[dstOff+1] = uint8(clamp(g+0.5, 0, 255))
			dst.Pix[dstOff+2] = uint8(clamp(b+0.5, 0, 255))
			dst.Pix[dstOff+3] = uint8(clamp(a+0.5, 0, 255))
		}
	}

	return nil
}

func convolveRGBA(dst *image.RGBA, src image.Image, k Kernel) error {
	b := dst.Bounds()
	bs := src.Bounds()
	w := k.Weights()
	size, err := kernelSize(w)
	if err != nil {
		return err
	}
	radius := (size - 1) / 2

	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			if !image.Pt(x, y).In(bs) {
				continue
			}

			var r, g, b, a, adj float64
			for cy := y - radius; cy <= y+radius; cy++ {
				for cx := x - radius; cx <= x+radius; cx++ {
					factor := w[(cy-y+radius)*size+cx-x+radius]
					if !image.Pt(cx, cy).In(bs) {
						adj += factor
					} else {
						sr, sg, sb, sa := src.At(cx, cy).RGBA()
						r += float64(sr>>8) * factor
						g += float64(sg>>8) * factor
						b += float64(sb>>8) * factor
						a += float64(sa>>8) * factor
					}
				}
			}

			if adj != 0 {
				sr, sg, sb, sa := src.At(x, y).RGBA()
				r += float64(sr>>8) * adj
				g += float64(sg>>8) * adj
				b += float64(sb>>8) * adj
				a += float64(sa>>8) * adj
			}

			off := (y-dst.Rect.Min.Y)*dst.Stride + (x-dst.Rect.Min.X)*4
			dst.Pix[off+0] = uint8(clamp(r+0.5, 0, 0xff))
			dst.Pix[off+1] = uint8(clamp(g+0.5, 0, 0xff))
			dst.Pix[off+2] = uint8(clamp(b+0.5, 0, 0xff))
			dst.Pix[off+3] = uint8(clamp(a+0.5, 0, 0xff))
		}
	}

	return nil
}

// Convolve produces dst by applying the convolution kernel k to src.
func Convolve(dst draw.Image, src image.Image, k Kernel) (err error) {
	if dst == nil || src == nil || k == nil {
		return nil
	}

	b := dst.Bounds()
	dstRgba, ok := dst.(*image.RGBA)
	if !ok {
		dstRgba = image.NewRGBA(b)
	}

	switch k := k.(type) {
	case *SeparableKernel:
		err = convolveRGBASep(dstRgba, src, k)
	default:
		err = convolveRGBA(dstRgba, src, k)
	}

	if err != nil {
		return err
	}

	if !ok {
		draw.Draw(dst, b, dstRgba, b.Min, draw.Src)
	}
	return nil
}
