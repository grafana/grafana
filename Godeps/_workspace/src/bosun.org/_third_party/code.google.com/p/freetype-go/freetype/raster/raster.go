// Copyright 2010 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

// The raster package provides an anti-aliasing 2-D rasterizer.
//
// It is part of the larger Freetype-Go suite of font-related packages,
// but the raster package is not specific to font rasterization, and can
// be used standalone without any other Freetype-Go package.
//
// Rasterization is done by the same area/coverage accumulation algorithm
// as the Freetype "smooth" module, and the Anti-Grain Geometry library.
// A description of the area/coverage algorithm is at
// http://projects.tuxee.net/cl-vectors/section-the-cl-aa-algorithm
package raster

import (
	"strconv"
)

// A cell is part of a linked list (for a given yi co-ordinate) of accumulated
// area/coverage for the pixel at (xi, yi).
type cell struct {
	xi          int
	area, cover int
	next        int
}

type Rasterizer struct {
	// If false, the default behavior is to use the even-odd winding fill
	// rule during Rasterize.
	UseNonZeroWinding bool
	// An offset (in pixels) to the painted spans.
	Dx, Dy int

	// The width of the Rasterizer. The height is implicit in len(cellIndex).
	width int
	// splitScaleN is the scaling factor used to determine how many times
	// to decompose a quadratic or cubic segment into a linear approximation.
	splitScale2, splitScale3 int

	// The current pen position.
	a Point
	// The current cell and its area/coverage being accumulated.
	xi, yi      int
	area, cover int

	// Saved cells.
	cell []cell
	// Linked list of cells, one per row.
	cellIndex []int
	// Buffers.
	cellBuf      [256]cell
	cellIndexBuf [64]int
	spanBuf      [64]Span
}

// findCell returns the index in r.cell for the cell corresponding to
// (r.xi, r.yi). The cell is created if necessary.
func (r *Rasterizer) findCell() int {
	if r.yi < 0 || r.yi >= len(r.cellIndex) {
		return -1
	}
	xi := r.xi
	if xi < 0 {
		xi = -1
	} else if xi > r.width {
		xi = r.width
	}
	i, prev := r.cellIndex[r.yi], -1
	for i != -1 && r.cell[i].xi <= xi {
		if r.cell[i].xi == xi {
			return i
		}
		i, prev = r.cell[i].next, i
	}
	c := len(r.cell)
	if c == cap(r.cell) {
		buf := make([]cell, c, 4*c)
		copy(buf, r.cell)
		r.cell = buf[0 : c+1]
	} else {
		r.cell = r.cell[0 : c+1]
	}
	r.cell[c] = cell{xi, 0, 0, i}
	if prev == -1 {
		r.cellIndex[r.yi] = c
	} else {
		r.cell[prev].next = c
	}
	return c
}

// saveCell saves any accumulated r.area/r.cover for (r.xi, r.yi).
func (r *Rasterizer) saveCell() {
	if r.area != 0 || r.cover != 0 {
		i := r.findCell()
		if i != -1 {
			r.cell[i].area += r.area
			r.cell[i].cover += r.cover
		}
		r.area = 0
		r.cover = 0
	}
}

// setCell sets the (xi, yi) cell that r is accumulating area/coverage for.
func (r *Rasterizer) setCell(xi, yi int) {
	if r.xi != xi || r.yi != yi {
		r.saveCell()
		r.xi, r.yi = xi, yi
	}
}

// scan accumulates area/coverage for the yi'th scanline, going from
// x0 to x1 in the horizontal direction (in 24.8 fixed point co-ordinates)
// and from y0f to y1f fractional vertical units within that scanline.
func (r *Rasterizer) scan(yi int, x0, y0f, x1, y1f Fix32) {
	// Break the 24.8 fixed point X co-ordinates into integral and fractional parts.
	x0i := int(x0) / 256
	x0f := x0 - Fix32(256*x0i)
	x1i := int(x1) / 256
	x1f := x1 - Fix32(256*x1i)

	// A perfectly horizontal scan.
	if y0f == y1f {
		r.setCell(x1i, yi)
		return
	}
	dx, dy := x1-x0, y1f-y0f
	// A single cell scan.
	if x0i == x1i {
		r.area += int((x0f + x1f) * dy)
		r.cover += int(dy)
		return
	}
	// There are at least two cells. Apart from the first and last cells,
	// all intermediate cells go through the full width of the cell,
	// or 256 units in 24.8 fixed point format.
	var (
		p, q, edge0, edge1 Fix32
		xiDelta            int
	)
	if dx > 0 {
		p, q = (256-x0f)*dy, dx
		edge0, edge1, xiDelta = 0, 256, 1
	} else {
		p, q = x0f*dy, -dx
		edge0, edge1, xiDelta = 256, 0, -1
	}
	yDelta, yRem := p/q, p%q
	if yRem < 0 {
		yDelta -= 1
		yRem += q
	}
	// Do the first cell.
	xi, y := x0i, y0f
	r.area += int((x0f + edge1) * yDelta)
	r.cover += int(yDelta)
	xi, y = xi+xiDelta, y+yDelta
	r.setCell(xi, yi)
	if xi != x1i {
		// Do all the intermediate cells.
		p = 256 * (y1f - y + yDelta)
		fullDelta, fullRem := p/q, p%q
		if fullRem < 0 {
			fullDelta -= 1
			fullRem += q
		}
		yRem -= q
		for xi != x1i {
			yDelta = fullDelta
			yRem += fullRem
			if yRem >= 0 {
				yDelta += 1
				yRem -= q
			}
			r.area += int(256 * yDelta)
			r.cover += int(yDelta)
			xi, y = xi+xiDelta, y+yDelta
			r.setCell(xi, yi)
		}
	}
	// Do the last cell.
	yDelta = y1f - y
	r.area += int((edge0 + x1f) * yDelta)
	r.cover += int(yDelta)
}

// Start starts a new curve at the given point.
func (r *Rasterizer) Start(a Point) {
	r.setCell(int(a.X/256), int(a.Y/256))
	r.a = a
}

// Add1 adds a linear segment to the current curve.
func (r *Rasterizer) Add1(b Point) {
	x0, y0 := r.a.X, r.a.Y
	x1, y1 := b.X, b.Y
	dx, dy := x1-x0, y1-y0
	// Break the 24.8 fixed point Y co-ordinates into integral and fractional parts.
	y0i := int(y0) / 256
	y0f := y0 - Fix32(256*y0i)
	y1i := int(y1) / 256
	y1f := y1 - Fix32(256*y1i)

	if y0i == y1i {
		// There is only one scanline.
		r.scan(y0i, x0, y0f, x1, y1f)

	} else if dx == 0 {
		// This is a vertical line segment. We avoid calling r.scan and instead
		// manipulate r.area and r.cover directly.
		var (
			edge0, edge1 Fix32
			yiDelta      int
		)
		if dy > 0 {
			edge0, edge1, yiDelta = 0, 256, 1
		} else {
			edge0, edge1, yiDelta = 256, 0, -1
		}
		x0i, yi := int(x0)/256, y0i
		x0fTimes2 := (int(x0) - (256 * x0i)) * 2
		// Do the first pixel.
		dcover := int(edge1 - y0f)
		darea := int(x0fTimes2 * dcover)
		r.area += darea
		r.cover += dcover
		yi += yiDelta
		r.setCell(x0i, yi)
		// Do all the intermediate pixels.
		dcover = int(edge1 - edge0)
		darea = int(x0fTimes2 * dcover)
		for yi != y1i {
			r.area += darea
			r.cover += dcover
			yi += yiDelta
			r.setCell(x0i, yi)
		}
		// Do the last pixel.
		dcover = int(y1f - edge0)
		darea = int(x0fTimes2 * dcover)
		r.area += darea
		r.cover += dcover

	} else {
		// There are at least two scanlines. Apart from the first and last scanlines,
		// all intermediate scanlines go through the full height of the row, or 256
		// units in 24.8 fixed point format.
		var (
			p, q, edge0, edge1 Fix32
			yiDelta            int
		)
		if dy > 0 {
			p, q = (256-y0f)*dx, dy
			edge0, edge1, yiDelta = 0, 256, 1
		} else {
			p, q = y0f*dx, -dy
			edge0, edge1, yiDelta = 256, 0, -1
		}
		xDelta, xRem := p/q, p%q
		if xRem < 0 {
			xDelta -= 1
			xRem += q
		}
		// Do the first scanline.
		x, yi := x0, y0i
		r.scan(yi, x, y0f, x+xDelta, edge1)
		x, yi = x+xDelta, yi+yiDelta
		r.setCell(int(x)/256, yi)
		if yi != y1i {
			// Do all the intermediate scanlines.
			p = 256 * dx
			fullDelta, fullRem := p/q, p%q
			if fullRem < 0 {
				fullDelta -= 1
				fullRem += q
			}
			xRem -= q
			for yi != y1i {
				xDelta = fullDelta
				xRem += fullRem
				if xRem >= 0 {
					xDelta += 1
					xRem -= q
				}
				r.scan(yi, x, edge0, x+xDelta, edge1)
				x, yi = x+xDelta, yi+yiDelta
				r.setCell(int(x)/256, yi)
			}
		}
		// Do the last scanline.
		r.scan(yi, x, edge0, x1, y1f)
	}
	// The next lineTo starts from b.
	r.a = b
}

// Add2 adds a quadratic segment to the current curve.
func (r *Rasterizer) Add2(b, c Point) {
	// Calculate nSplit (the number of recursive decompositions) based on how `curvy' it is.
	// Specifically, how much the middle point b deviates from (a+c)/2.
	dev := maxAbs(r.a.X-2*b.X+c.X, r.a.Y-2*b.Y+c.Y) / Fix32(r.splitScale2)
	nsplit := 0
	for dev > 0 {
		dev /= 4
		nsplit++
	}
	// dev is 32-bit, and nsplit++ every time we shift off 2 bits, so maxNsplit is 16.
	const maxNsplit = 16
	if nsplit > maxNsplit {
		panic("freetype/raster: Add2 nsplit too large: " + strconv.Itoa(nsplit))
	}
	// Recursively decompose the curve nSplit levels deep.
	var (
		pStack [2*maxNsplit + 3]Point
		sStack [maxNsplit + 1]int
		i      int
	)
	sStack[0] = nsplit
	pStack[0] = c
	pStack[1] = b
	pStack[2] = r.a
	for i >= 0 {
		s := sStack[i]
		p := pStack[2*i:]
		if s > 0 {
			// Split the quadratic curve p[:3] into an equivalent set of two shorter curves:
			// p[:3] and p[2:5]. The new p[4] is the old p[2], and p[0] is unchanged.
			mx := p[1].X
			p[4].X = p[2].X
			p[3].X = (p[4].X + mx) / 2
			p[1].X = (p[0].X + mx) / 2
			p[2].X = (p[1].X + p[3].X) / 2
			my := p[1].Y
			p[4].Y = p[2].Y
			p[3].Y = (p[4].Y + my) / 2
			p[1].Y = (p[0].Y + my) / 2
			p[2].Y = (p[1].Y + p[3].Y) / 2
			// The two shorter curves have one less split to do.
			sStack[i] = s - 1
			sStack[i+1] = s - 1
			i++
		} else {
			// Replace the level-0 quadratic with a two-linear-piece approximation.
			midx := (p[0].X + 2*p[1].X + p[2].X) / 4
			midy := (p[0].Y + 2*p[1].Y + p[2].Y) / 4
			r.Add1(Point{midx, midy})
			r.Add1(p[0])
			i--
		}
	}
}

// Add3 adds a cubic segment to the current curve.
func (r *Rasterizer) Add3(b, c, d Point) {
	// Calculate nSplit (the number of recursive decompositions) based on how `curvy' it is.
	dev2 := maxAbs(r.a.X-3*(b.X+c.X)+d.X, r.a.Y-3*(b.Y+c.Y)+d.Y) / Fix32(r.splitScale2)
	dev3 := maxAbs(r.a.X-2*b.X+d.X, r.a.Y-2*b.Y+d.Y) / Fix32(r.splitScale3)
	nsplit := 0
	for dev2 > 0 || dev3 > 0 {
		dev2 /= 8
		dev3 /= 4
		nsplit++
	}
	// devN is 32-bit, and nsplit++ every time we shift off 2 bits, so maxNsplit is 16.
	const maxNsplit = 16
	if nsplit > maxNsplit {
		panic("freetype/raster: Add3 nsplit too large: " + strconv.Itoa(nsplit))
	}
	// Recursively decompose the curve nSplit levels deep.
	var (
		pStack [3*maxNsplit + 4]Point
		sStack [maxNsplit + 1]int
		i      int
	)
	sStack[0] = nsplit
	pStack[0] = d
	pStack[1] = c
	pStack[2] = b
	pStack[3] = r.a
	for i >= 0 {
		s := sStack[i]
		p := pStack[3*i:]
		if s > 0 {
			// Split the cubic curve p[:4] into an equivalent set of two shorter curves:
			// p[:4] and p[3:7]. The new p[6] is the old p[3], and p[0] is unchanged.
			m01x := (p[0].X + p[1].X) / 2
			m12x := (p[1].X + p[2].X) / 2
			m23x := (p[2].X + p[3].X) / 2
			p[6].X = p[3].X
			p[5].X = m23x
			p[1].X = m01x
			p[2].X = (m01x + m12x) / 2
			p[4].X = (m12x + m23x) / 2
			p[3].X = (p[2].X + p[4].X) / 2
			m01y := (p[0].Y + p[1].Y) / 2
			m12y := (p[1].Y + p[2].Y) / 2
			m23y := (p[2].Y + p[3].Y) / 2
			p[6].Y = p[3].Y
			p[5].Y = m23y
			p[1].Y = m01y
			p[2].Y = (m01y + m12y) / 2
			p[4].Y = (m12y + m23y) / 2
			p[3].Y = (p[2].Y + p[4].Y) / 2
			// The two shorter curves have one less split to do.
			sStack[i] = s - 1
			sStack[i+1] = s - 1
			i++
		} else {
			// Replace the level-0 cubic with a two-linear-piece approximation.
			midx := (p[0].X + 3*(p[1].X+p[2].X) + p[3].X) / 8
			midy := (p[0].Y + 3*(p[1].Y+p[2].Y) + p[3].Y) / 8
			r.Add1(Point{midx, midy})
			r.Add1(p[0])
			i--
		}
	}
}

// AddPath adds the given Path.
func (r *Rasterizer) AddPath(p Path) {
	for i := 0; i < len(p); {
		switch p[i] {
		case 0:
			r.Start(Point{p[i+1], p[i+2]})
			i += 4
		case 1:
			r.Add1(Point{p[i+1], p[i+2]})
			i += 4
		case 2:
			r.Add2(Point{p[i+1], p[i+2]}, Point{p[i+3], p[i+4]})
			i += 6
		case 3:
			r.Add3(Point{p[i+1], p[i+2]}, Point{p[i+3], p[i+4]}, Point{p[i+5], p[i+6]})
			i += 8
		default:
			panic("freetype/raster: bad path")
		}
	}
}

// AddStroke adds a stroked Path.
func (r *Rasterizer) AddStroke(q Path, width Fix32, cr Capper, jr Joiner) {
	Stroke(r, q, width, cr, jr)
}

// Converts an area value to a uint32 alpha value. A completely filled pixel
// corresponds to an area of 256*256*2, and an alpha of 1<<32-1. The
// conversion of area values greater than this depends on the winding rule:
// even-odd or non-zero.
func (r *Rasterizer) areaToAlpha(area int) uint32 {
	// The C Freetype implementation (version 2.3.12) does "alpha := area>>1" without
	// the +1. Round-to-nearest gives a more symmetric result than round-down.
	// The C implementation also returns 8-bit alpha, not 32-bit alpha.
	a := (area + 1) >> 1
	if a < 0 {
		a = -a
	}
	alpha := uint32(a)
	if r.UseNonZeroWinding {
		if alpha > 0xffff {
			alpha = 0xffff
		}
	} else {
		alpha &= 0x1ffff
		if alpha > 0x10000 {
			alpha = 0x20000 - alpha
		} else if alpha == 0x10000 {
			alpha = 0x0ffff
		}
	}
	alpha |= alpha << 16
	return alpha
}

// Rasterize converts r's accumulated curves into Spans for p. The Spans
// passed to p are non-overlapping, and sorted by Y and then X. They all
// have non-zero width (and 0 <= X0 < X1 <= r.width) and non-zero A, except
// for the final Span, which has Y, X0, X1 and A all equal to zero.
func (r *Rasterizer) Rasterize(p Painter) {
	r.saveCell()
	s := 0
	for yi := 0; yi < len(r.cellIndex); yi++ {
		xi, cover := 0, 0
		for c := r.cellIndex[yi]; c != -1; c = r.cell[c].next {
			if cover != 0 && r.cell[c].xi > xi {
				alpha := r.areaToAlpha(cover * 256 * 2)
				if alpha != 0 {
					xi0, xi1 := xi, r.cell[c].xi
					if xi0 < 0 {
						xi0 = 0
					}
					if xi1 >= r.width {
						xi1 = r.width
					}
					if xi0 < xi1 {
						r.spanBuf[s] = Span{yi + r.Dy, xi0 + r.Dx, xi1 + r.Dx, alpha}
						s++
					}
				}
			}
			cover += r.cell[c].cover
			alpha := r.areaToAlpha(cover*256*2 - r.cell[c].area)
			xi = r.cell[c].xi + 1
			if alpha != 0 {
				xi0, xi1 := r.cell[c].xi, xi
				if xi0 < 0 {
					xi0 = 0
				}
				if xi1 >= r.width {
					xi1 = r.width
				}
				if xi0 < xi1 {
					r.spanBuf[s] = Span{yi + r.Dy, xi0 + r.Dx, xi1 + r.Dx, alpha}
					s++
				}
			}
			if s > len(r.spanBuf)-2 {
				p.Paint(r.spanBuf[:s], false)
				s = 0
			}
		}
	}
	p.Paint(r.spanBuf[:s], true)
}

// Clear cancels any previous calls to r.Start or r.AddXxx.
func (r *Rasterizer) Clear() {
	r.a = Point{}
	r.xi = 0
	r.yi = 0
	r.area = 0
	r.cover = 0
	r.cell = r.cell[:0]
	for i := 0; i < len(r.cellIndex); i++ {
		r.cellIndex[i] = -1
	}
}

// SetBounds sets the maximum width and height of the rasterized image and
// calls Clear. The width and height are in pixels, not Fix32 units.
func (r *Rasterizer) SetBounds(width, height int) {
	if width < 0 {
		width = 0
	}
	if height < 0 {
		height = 0
	}
	// Use the same ssN heuristic as the C Freetype implementation.
	// The C implementation uses the values 32, 16, but those are in
	// 26.6 fixed point units, and we use 24.8 fixed point everywhere.
	ss2, ss3 := 128, 64
	if width > 24 || height > 24 {
		ss2, ss3 = 2*ss2, 2*ss3
		if width > 120 || height > 120 {
			ss2, ss3 = 2*ss2, 2*ss3
		}
	}
	r.width = width
	r.splitScale2 = ss2
	r.splitScale3 = ss3
	r.cell = r.cellBuf[:0]
	if height > len(r.cellIndexBuf) {
		r.cellIndex = make([]int, height)
	} else {
		r.cellIndex = r.cellIndexBuf[:height]
	}
	r.Clear()
}

// NewRasterizer creates a new Rasterizer with the given bounds.
func NewRasterizer(width, height int) *Rasterizer {
	r := new(Rasterizer)
	r.SetBounds(width, height)
	return r
}
