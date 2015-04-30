package chart

import (
	"fmt"
	"image/color"
	"math"
)

// MinimalGraphics is the interface any graphics driver must implement,
// so that he can fall back to the generic routines for the higher level
// outputs.
type MinimalGraphics interface {
	Background() (r, g, b, a uint8)                         // Color of background
	FontMetrics(font Font) (fw float32, fh int, mono bool)  // Return fontwidth and -height in pixel
	TextLen(t string, font Font) int                        // Length=width of t in screen units if set on font
	Line(x0, y0, x1, y1 int, style Style)                   // Draw line from (x0,y0) to (x1,y1)
	Text(x, y int, t string, align string, rot int, f Font) // Put t at (x,y) rotated by rot aligned [[tcb]][lcr]
}

// BasicGrapic is an interface of the most basic graphic primitives.
// Any type which implements BasicGraphics can use generic implementations
// of the Graphics methods.
type BasicGraphics interface {
	MinimalGraphics
	Symbol(x, y int, style Style)                          // Put symbol s at (x,y)
	Rect(x, y, w, h int, style Style)                      // Draw (w x h) rectangle at (x,y)
	Wedge(x, y, ro, ri int, phi, psi float64, style Style) // Wedge
	Path(x, y []int, style Style)                          // Path of straight lines
	Options() PlotOptions                                  // access to current PlotOptions
}

// Graphics is the interface all chart drivers have to implement
type Graphics interface {
	BasicGraphics

	Dimensions() (int, int) // character-width / height

	Begin() // start of chart drawing
	End()   // Done, cleanup

	// All stuff is preprocessed: sanitized, clipped, strings formated, integer coords,
	// screen coordinates,
	XAxis(xr Range, ys, yms int, options PlotOptions) // Draw x axis xr at screen position ys (and yms if mirrored)
	YAxis(yr Range, xs, xms int, options PlotOptions) // Same for y axis.

	Scatter(points []EPoint, plotstyle PlotStyle, style Style) // Points, Lines and Line+Points
	Boxes(boxes []Box, width int, style Style)                 // Boxplots
	Bars(bars []Barinfo, style Style)                          // any type of histogram/bars
	Rings(wedeges []Wedgeinfo, x, y, ro, ri int)               // Pie/ring diagram elements

	Key(x, y int, key Key, options PlotOptions) // place key at x,y
}

type Barinfo struct {
	x, y  int    // (x,y) of top left corner;
	w, h  int    // width and heigt
	t, tp string // label text and text position '[oi][tblr]' or 'c'
	f     Font   // font of text
}

type Wedgeinfo struct {
	Phi, Psi float64 // Start and ende of wedge. Fuill circle if |phi-psi| > 4pi
	Text, Tp string  // label text and text position: [ico]
	Style    Style   // style of this wedge
	Font     Font    // font of text
	Shift    int     // Highlighting of wedge
}

func GenericTextLen(mg MinimalGraphics, t string, font Font) (width int) {
	// TODO: how handle newlines?  same way like Text does
	fw, _, mono := mg.FontMetrics(font)
	if mono {
		for _ = range t {
			width++
		}
		width = int(float32(width)*fw + 0.5)
	} else {
		var length float32
		for _, r := range t {
			if w, ok := CharacterWidth[int(r)]; ok {
				length += w
			} else {
				length += 20 // save above average
			}
		}
		length /= averageCharacterWidth
		length *= fw
		width = int(length + 0.5)
	}
	return
}

// Normalize (= (x,y) is top-left and w and h>0) and hounour line width r.
func SanitizeRect(x, y, w, h, r int) (int, int, int, int) {
	if w < 0 {
		x += w
		w = -w
	}
	if h < 0 {
		y += h
		h = -h
	}

	d := (imax(1, r) - 1) / 2
	// TODO: what if w-2D <= 0 ?
	return x + d, y + d, w - 2*d, h - 2*d
}

// GenericRect draws a rectangle of size w x h at (x,y).  Drawing is done
// by simple lines only.
func GenericRect(mg MinimalGraphics, x, y, w, h int, style Style) {
	x, y, w, h = SanitizeRect(x, y, w, h, style.LineWidth)

	if style.FillColor != nil {
		fs := Style{LineWidth: 1, LineColor: style.FillColor, LineStyle: SolidLine}
		for i := 1; i < h; i++ {
			mg.Line(x+1, y+i, x+w-1, y+i, fs)
		}
	}

	mg.Line(x, y, x+w, y, style)
	mg.Line(x+w, y, x+w, y+h, style)
	mg.Line(x+w, y+h, x, y+h, style)
	mg.Line(x, y+h, x, y, style)
}

// GenericPath is the incomplete implementation of a list of points
// connected by straight lines. Incomplete: Dashed lines won't work properly.
func GenericPath(mg MinimalGraphics, x, y []int, style Style) {
	n := imin(len(x), len(y))
	for i := 1; i < n; i++ {
		mg.Line(x[i-1], y[i-1], x[i], y[i], style)
	}
}

func drawXTics(bg BasicGraphics, rng Range, y, ym, ticLen int, options PlotOptions) {
	xe := rng.Data2Screen(rng.Max)

	// Grid below tics
	if rng.TicSetting.Grid > GridOff {
		for ticcnt, tic := range rng.Tics {
			x := rng.Data2Screen(tic.Pos)
			if ticcnt >= 0 && ticcnt <= len(rng.Tics)-1 && rng.TicSetting.Grid == GridLines {
				// fmt.Printf("Gridline at x=%d\n", x)
				bg.Line(x, y-1, x, ym+1, elementStyle(options, GridLineElement))
			} else if rng.TicSetting.Grid == GridBlocks {
				if ticcnt%2 == 1 {
					x0 := rng.Data2Screen(rng.Tics[ticcnt-1].Pos)
					bg.Rect(x0, ym, x-x0, y-ym, elementStyle(options, GridBlockElement))
				} else if ticcnt == len(rng.Tics)-1 && x < xe-1 {
					bg.Rect(x, ym, xe-x, y-ym, elementStyle(options, GridBlockElement))
				}
			}
		}
	}

	// Tics on top
	ticstyle := elementStyle(options, MajorTicElement)
	ticfont := ticstyle.Font
	for _, tic := range rng.Tics {
		x := rng.Data2Screen(tic.Pos)
		lx := rng.Data2Screen(tic.LabelPos)

		// Tics
		switch rng.TicSetting.Tics {
		case 0:
			bg.Line(x, y-ticLen, x, y+ticLen, ticstyle)
		case 1:
			bg.Line(x, y-ticLen, x, y, ticstyle)
		case 2:
			bg.Line(x, y, x, y+ticLen, ticstyle)
		default:
		}

		// Mirrored Tics
		if rng.TicSetting.Mirror >= 2 {
			switch rng.TicSetting.Tics {
			case 0:
				bg.Line(x, ym-ticLen, x, ym+ticLen, ticstyle)
			case 1:
				bg.Line(x, ym, x, ym+ticLen, ticstyle)
			case 2:
				bg.Line(x, ym-ticLen, x, ym, ticstyle)
			default:
			}
		}

		if !rng.TicSetting.HideLabels {
			// Tic-Label
			if rng.Time && tic.Align == -1 {
				bg.Line(x, y+ticLen, x, y+2*ticLen, ticstyle)
				bg.Text(lx, y+2*ticLen, tic.Label, "tl", 0, ticfont)
			} else {
				bg.Text(lx, y+2*ticLen, tic.Label, "tc", 0, ticfont)
			}
		}
	}
}

// GenericAxis draws the axis r solely by graphic primitives of bg.
func GenericXAxis(bg BasicGraphics, rng Range, y, ym int, options PlotOptions) {
	_, fontheight, _ := bg.FontMetrics(elementStyle(options, MajorTicElement).Font)
	var ticLen int = 0
	if !rng.TicSetting.Hide {
		ticLen = imin(12, imax(4, fontheight/2))
	}
	xa, xe := rng.Data2Screen(rng.Min), rng.Data2Screen(rng.Max)

	// Axis label and range limits
	aly := y + 2*ticLen
	if !rng.TicSetting.Hide {
		aly += (3 * fontheight) / 2
	}
	if rng.ShowLimits {
		font := elementStyle(options, RangeLimitElement).Font
		if rng.Time {
			bg.Text(xa, aly, rng.TMin.Format("2006-01-02 15:04:05"), "tl", 0, font)
			bg.Text(xe, aly, rng.TMax.Format("2006-01-02 15:04:05"), "tr", 0, font)
		} else {
			bg.Text(xa, aly, fmt.Sprintf("%g", rng.Min), "tl", 0, font)
			bg.Text(xe, aly, fmt.Sprintf("%g", rng.Max), "tr", 0, font)
		}
	}
	if rng.Label != "" { // draw label _after_ (=over) range limits
		font := elementStyle(options, MajorAxisElement).Font
		bg.Text((xa+xe)/2, aly, "  "+rng.Label+"  ", "tc", 0, font)
	}

	// Tics and Grid
	if !rng.TicSetting.Hide {
		drawXTics(bg, rng, y, ym, ticLen, options)
	}

	// Axis itself, mirrord axis and zero
	bg.Line(xa, y, xe, y, elementStyle(options, MajorAxisElement))
	if rng.TicSetting.Mirror >= 1 {
		bg.Line(xa, ym, xe, ym, elementStyle(options, MinorAxisElement))
	}
	if rng.ShowZero && rng.Min < 0 && rng.Max > 0 {
		z := rng.Data2Screen(0)
		bg.Line(z, y, z, ym, elementStyle(options, ZeroAxisElement))
	}

}

func drawYTics(bg BasicGraphics, rng Range, x, xm, ticLen int, options PlotOptions) {
	ye := rng.Data2Screen(rng.Max)

	// Grid below tics
	if rng.TicSetting.Grid > GridOff {
		for ticcnt, tic := range rng.Tics {
			y := rng.Data2Screen(tic.Pos)
			if rng.TicSetting.Grid == GridLines {
				if ticcnt > 0 && ticcnt < len(rng.Tics)-1 {
					// fmt.Printf("Gridline at x=%d\n", x)
					bg.Line(x+1, y, xm-1, y, elementStyle(options, GridLineElement))
				}
			} else if rng.TicSetting.Grid == GridBlocks {
				if ticcnt%2 == 1 {
					y0 := rng.Data2Screen(rng.Tics[ticcnt-1].Pos)
					bg.Rect(x, y0, xm-x, y-y0, elementStyle(options, GridBlockElement))
				} else if ticcnt == len(rng.Tics)-1 && y > ye+1 {
					bg.Rect(x, ye, xm-x, y-ye, elementStyle(options, GridBlockElement))
				}
			}
		}
	}

	// Tics on top
	ticstyle := elementStyle(options, MajorTicElement)
	ticfont := ticstyle.Font
	for _, tic := range rng.Tics {
		y := rng.Data2Screen(tic.Pos)
		ly := rng.Data2Screen(tic.LabelPos)

		// Tics
		switch rng.TicSetting.Tics {
		case 0:
			bg.Line(x-ticLen, y, x+ticLen, y, ticstyle)
		case 1:
			bg.Line(x, y, x+ticLen, y, ticstyle)
		case 2:
			bg.Line(x-ticLen, y, x, y, ticstyle)
		default:
		}

		// Mirrored tics
		if rng.TicSetting.Mirror >= 2 {
			switch rng.TicSetting.Tics {
			case 0:
				bg.Line(xm-ticLen, y, xm+ticLen, y, ticstyle)
			case 1:
				bg.Line(xm-ticLen, y, xm, y, ticstyle)
			case 2:
				bg.Line(xm, y, xm+ticLen, y, ticstyle)
			default:
			}
		}

		if !rng.TicSetting.HideLabels {
			// Label
			if rng.Time && tic.Align == 0 { // centered tic
				bg.Line(x-2*ticLen, y, x+ticLen, y, ticstyle)
				bg.Text(x-ticLen, ly, tic.Label, "cr", 0, ticfont)
			} else {
				bg.Text(x-2*ticLen, ly, tic.Label, "cr", 0, ticfont)
			}
		}
	}

}

// GenericAxis draws the axis r solely by graphic primitives of bg.
func GenericYAxis(bg BasicGraphics, rng Range, x, xm int, options PlotOptions) {
	font := elementStyle(options, MajorAxisElement).Font
	_, fontheight, _ := bg.FontMetrics(font)
	var ticLen int = 0
	if !rng.TicSetting.Hide {
		ticLen = imin(10, imax(4, fontheight/2))
	}
	ya, ye := rng.Data2Screen(rng.Min), rng.Data2Screen(rng.Max)

	// Label and axis ranges
	alx := 2 * fontheight
	if rng.ShowLimits {
		/* TODO
		st := bg.Style("rangelimit")
		if rng.Time {
			bg.Text(xa, aly, rng.TMin.Format("2006-01-02 15:04:05"), "tl", 0, st)
			bg.Text(xe, aly, rng.TMax.Format("2006-01-02 15:04:05"), "tr", 0, st)
		} else {
			bg.Text(xa, aly, fmt.Sprintf("%g", rng.Min), "tl", 0, st)
			bg.Text(xe, aly, fmt.Sprintf("%g", rng.Max), "tr", 0, st)
		}
		*/
	}
	if rng.Label != "" {
		y := (ya + ye) / 2
		bg.Text(alx, y, rng.Label, "bc", 90, font)
	}

	if !rng.TicSetting.Hide {
		drawYTics(bg, rng, x, xm, ticLen, options)
	}

	// Axis itself, mirrord axis and zero
	bg.Line(x, ya, x, ye, elementStyle(options, MajorAxisElement))
	if rng.TicSetting.Mirror >= 1 {
		bg.Line(xm, ya, xm, ye, elementStyle(options, MinorAxisElement))
	}
	if rng.ShowZero && rng.Min < 0 && rng.Max > 0 {
		z := rng.Data2Screen(0)
		bg.Line(x, z, xm, z, elementStyle(options, ZeroAxisElement))
	}

}

// GenericScatter draws the given points according to style.
// style.FillColor is used as color of error bars and style.FontSize is used
// as the length of the endmarks of the error bars. Both have suitable defaults
// if the FontXyz are not set. Point coordinates and errors must be provided
// in screen coordinates.
func GenericScatter(bg BasicGraphics, points []EPoint, plotstyle PlotStyle, style Style) {

	// First pass: Error bars
	ebs := style
	ebs.LineColor, ebs.LineWidth, ebs.LineStyle = ebs.FillColor, 1, SolidLine
	if ebs.LineColor == nil {
		ebs.LineColor = color.NRGBA{0x40, 0x40, 0x40, 0xff}
	}
	if ebs.LineWidth == 0 {
		ebs.LineWidth = 1
	}
	for _, p := range points {

		xl, yl, xh, yh := p.BoundingBox()
		// fmt.Printf("Draw %d: %f %f-%f; %f %f-%f\n", i, p.DeltaX, xl,xh, p.DeltaY, yl,yh)
		if !math.IsNaN(p.DeltaX) {
			bg.Line(int(xl), int(p.Y), int(xh), int(p.Y), ebs)
		}
		if !math.IsNaN(p.DeltaY) {
			// fmt.Printf("  Draw %d,%d to %d,%d\n",int(p.X), int(yl), int(p.X), int(yh))
			bg.Line(int(p.X), int(yl), int(p.X), int(yh), ebs)
		}
	}

	// Second pass: Line
	if (plotstyle&PlotStyleLines) != 0 && len(points) > 0 {
		lastx, lasty := int(points[0].X), int(points[0].Y)
		for i := 1; i < len(points); i++ {
			x, y := int(points[i].X), int(points[i].Y)
			bg.Line(lastx, lasty, x, y, style)
			lastx, lasty = x, y
		}
	}

	// Third pass: symbols
	if (plotstyle&PlotStylePoints) != 0 && len(points) != 0 {
		for _, p := range points {
			// fmt.Printf("Point %d at %d,%d\n", i, int(p.X), int(p.Y))
			bg.Symbol(int(p.X), int(p.Y), style)
		}
	}
}

// GenericBoxes draws box plots. (Default implementation for box plots).
// The values for each box in boxes are in screen coordinates!
func GenericBoxes(bg BasicGraphics, boxes []Box, width int, style Style) {
	if width%2 == 0 {
		width += 1
	}
	hbw := (width - 1) / 2
	for _, d := range boxes {
		x := int(d.X)
		q1, q3 := int(d.Q1), int(d.Q3)
		// DebugLogger.Printf("q1=%d  q3=%d  q3-q1=%d", q1,q3,q3-q1)
		bg.Rect(x-hbw, q1, width, q3-q1, style)
		if !math.IsNaN(d.Med) {
			med := int(d.Med)
			bg.Line(x-hbw, med, x+hbw, med, style)
		}

		if !math.IsNaN(d.Avg) {
			bg.Symbol(x, int(d.Avg), style)
		}

		if !math.IsNaN(d.High) {
			bg.Line(x, q3, x, int(d.High), style)
		}

		if !math.IsNaN(d.Low) {
			bg.Line(x, q1, x, int(d.Low), style)
		}

		for _, y := range d.Outliers {
			bg.Symbol(x, int(y), style)
		}

	}

}

// TODO: Is Bars and Generic Bars useful at all? Replaceable by rect?
func GenericBars(bg BasicGraphics, bars []Barinfo, style Style) {
	for _, b := range bars {
		bg.Rect(b.x, b.y, b.w, b.h, style)
		if b.t != "" {
			var tx, ty int
			var a string
			_, fh, _ := bg.FontMetrics(b.f)
			if fh > 1 {
				fh /= 2
			}
			switch b.tp {
			case "ot":
				tx, ty, a = b.x+b.w/2, b.y-fh, "bc"
			case "it":
				tx, ty, a = b.x+b.w/2, b.y+fh, "tc"
			case "ib":
				tx, ty, a = b.x+b.w/2, b.y+b.h-fh, "bc"
			case "ob":
				tx, ty, a = b.x+b.w/2, b.y+b.h+fh, "tc"
			case "ol":
				tx, ty, a = b.x-fh, b.y+b.h/2, "cr"
			case "il":
				tx, ty, a = b.x+fh, b.y+b.h/2, "cl"
			case "or":
				tx, ty, a = b.x+b.w+fh, b.y+b.h/2, "cl"
			case "ir":
				tx, ty, a = b.x+b.w-fh, b.y+b.h/2, "cr"
			default:
				tx, ty, a = b.x+b.w/2, b.y+b.h/2, "cc"

			}

			bg.Text(tx, ty, b.t, a, 0, b.f)
		}
	}
}

// GenericWedge draws a pie/wedge just by lines
func GenericWedge(mg MinimalGraphics, x, y, ro, ri int, phi, psi, ecc float64, style Style) {
	for phi < 0 {
		phi += 2 * math.Pi
	}
	for psi < 0 {
		psi += 2 * math.Pi
	}
	for phi >= 2*math.Pi {
		phi -= 2 * math.Pi
	}
	for psi >= 2*math.Pi {
		psi -= 2 * math.Pi
	}
	// DebugLogger.Printf("GenericWedge centered at (%d,%d) from %.1f° to %.1f°, radius %d/%d (e=%.2f)", 	x, y, 180*phi/math.Pi, 180*psi/math.Pi, ro, ri, ecc)

	if ri > ro {
		panic("ri > ro is not possible")
	}

	if style.FillColor != nil {
		fillWedge(mg, x, y, ro, ri, phi, psi, ecc, style)
	}

	roe, rof := float64(ro)*ecc, float64(ro)
	rie, rif := float64(ri)*ecc, float64(ri)
	xa, ya := int(math.Cos(phi)*roe)+x, y-int(math.Sin(phi)*rof)
	xc, yc := int(math.Cos(psi)*roe)+x, y-int(math.Sin(psi)*rof)
	xai, yai := int(math.Cos(phi)*rie)+x, y-int(math.Sin(phi)*rif)
	xci, yci := int(math.Cos(psi)*rie)+x, y-int(math.Sin(psi)*rif)

	if math.Abs(phi-psi) >= 4*math.Pi {
		phi, psi = 0, 2*math.Pi
	} else {
		if ri > 0 {
			mg.Line(xai, yai, xa, ya, style)
			mg.Line(xci, yci, xc, yc, style)
		} else {
			mg.Line(x, y, xa, ya, style)
			mg.Line(x, y, xc, yc, style)
		}
	}

	var xb, yb int
	exit := phi < psi
	for rho := phi; !exit || rho < psi; rho += 0.05 { // aproximate circle by more than 120 corners polygon
		if rho >= 2*math.Pi {
			exit = true
			rho -= 2 * math.Pi
		}
		xb, yb = int(math.Cos(rho)*roe)+x, y-int(math.Sin(rho)*rof)
		mg.Line(xa, ya, xb, yb, style)
		xa, ya = xb, yb
	}
	mg.Line(xb, yb, xc, yc, style)

	if ri > 0 {
		exit := phi < psi
		for rho := phi; !exit || rho < psi; rho += 0.1 { // aproximate circle by more than 60 corner polygon
			if rho >= 2*math.Pi {
				exit = true
				rho -= 2 * math.Pi
			}
			xb, yb = int(math.Cos(rho)*rie)+x, y-int(math.Sin(rho)*rif)
			mg.Line(xai, yai, xb, yb, style)
			xai, yai = xb, yb
		}
		mg.Line(xb, yb, xci, yci, style)

	}
}

// Fill wedge with center (xi,yi), radius ri from alpha to beta with style.
// Precondition:  0 <= beta < alpha < pi/2
func fillQuarterWedge(mg MinimalGraphics, xi, yi, ri int, alpha, beta, e float64, style Style, quadrant int) {
	if alpha < beta {
		// DebugLogger.Printf("Swaping alpha and beta")
		alpha, beta = beta, alpha
	}
	// DebugLogger.Printf("fillQuaterWedge from %.1f to %.1f radius %d in quadrant %d.",	180*alpha/math.Pi, 180*beta/math.Pi, ri, quadrant)
	r := float64(ri)

	ta, tb := math.Tan(alpha), math.Tan(beta)
	for y := int(r * math.Sin(alpha)); y >= 0; y-- {
		yf := float64(y)
		x0 := yf / ta
		x1 := yf / tb
		x2 := math.Sqrt(r*r - yf*yf)
		// DebugLogger.Printf("y=%d  x0=%.2f    x1=%.2f    x2=%.2f  border=%t", y, x0, x1, x2, (x2<x1))
		if math.IsNaN(x1) || x2 < x1 {
			x1 = x2
		}

		var xx0, xx1, yy int
		switch quadrant {
		case 0:
			xx0 = int(x0*e+0.5) + xi
			xx1 = int(x1*e-0.5) + xi
			yy = yi - y
		case 3:
			xx0 = int(x0*e+0.5) + xi
			xx1 = int(x1*e-0.5) + xi
			yy = yi + y
		case 2:
			xx0 = xi - int(x0*e+0.5)
			xx1 = xi - int(x1*e-0.5)
			yy = yi + y
		case 1:
			xx0 = xi - int(x0*e+0.5)
			xx1 = xi - int(x1*e-0.5)
			yy = yi - y
		default:
			panic("No such quadrant.")
		}
		// DebugLogger.Printf("Line %d,%d to %d,%d", xx0,yy, xx1,yy)
		mg.Line(xx0, yy, xx1, yy, style)
	}
}

func quadrant(w float64) int {
	return int(math.Floor(2 * w / math.Pi))
}

func mapQ(w float64, q int) float64 {
	switch q {
	case 0:
		return w
	case 1:
		return math.Pi - w
	case 2:
		return w - math.Pi
	case 3:
		return 2*math.Pi - w
	default:
		panic("No such quadrant")
	}
	return w
}

// Fill wedge with center (xi,yi), radius ri from alpha to beta with style.
// Any combination of phi, psi allowed as long 0 <= phi < psi < 2pi.
func fillWedge(mg MinimalGraphics, xi, yi, ro, ri int, phi, psi, epsilon float64, style Style) {
	// ls := Style{LineColor: style.FillColor, LineWidth: 1, Symbol: style.Symbol}

	qPhi := quadrant(phi)
	qPsi := quadrant(psi)
	// DebugLogger.Printf("fillWedge from %.1f (%d) to %.1f (%d).", 180*phi/math.Pi, qPhi, 180*psi/math.Pi, qPsi)

	// prepare styles for filling
	style.LineColor = style.FillColor
	style.LineWidth = 1
	style.LineStyle = SolidLine
	blank := Style{
		Symbol:    ' ',
		LineColor: color.NRGBA{0xff, 0xff, 0xff, 0x00},
		FillColor: color.NRGBA{0xff, 0xff, 0xff, 0x00},
	}

	for qPhi != qPsi {
		// DebugLogger.Printf("qPhi = %d", qPhi)
		w := float64(qPhi+1) * math.Pi / 2
		if math.Abs(w-phi) > 0.01 {
			fillQuarterWedge(mg, xi, yi, ro, mapQ(phi, qPhi), mapQ(w, qPhi), epsilon, style, qPhi)
			if ri > 0 {
				fillQuarterWedge(mg, xi, yi, ri, mapQ(phi, qPhi), mapQ(w, qPhi), epsilon, blank, qPhi)
			}
		}
		phi = w
		qPhi++
		if qPhi == 4 {
			// DebugLogger.Printf("Wrapped phi around")
			phi, qPhi = 0, 0
		}
	}
	if phi != psi {
		// DebugLogger.Printf("Last wedge")
		fillQuarterWedge(mg, xi, yi, ro, mapQ(phi, qPhi), mapQ(psi, qPhi), epsilon, style, qPhi)
		if ri > 0 {
			fillQuarterWedge(mg, xi, yi, ri, mapQ(phi, qPhi), mapQ(psi, qPhi), epsilon, blank, qPhi)
		}
	}
}

func GenericRings(bg BasicGraphics, wedges []Wedgeinfo, x, y, ro, ri int, eccentricity float64) {
	// DebugLogger.Printf("GenericRings with %d wedges center %d,%d, radii %d/%d,  ecc=%.3f)", len(wedges), x, y, ro, ri, eccentricity)

	for _, w := range wedges {

		// Correct center
		d := float64(w.Style.LineWidth) / 2

		// cphi, sphi := math.Cos(w.Phi), math.Sin(w.Phi)
		// cpsi, spsi := math.Cos(w.Psi), math.Sin(w.Psi)
		delta := (w.Psi - w.Phi) / 2
		SinDelta := math.Sin(delta)
		gamma := (w.Phi + w.Psi) / 2
		k := d / SinDelta
		shift := float64(w.Shift)
		kx, ky := (k+shift)*math.Cos(gamma), (k+shift)*math.Sin(gamma)

		DebugLogger.Printf("Center adjustment (lw=%d, d=%.2f), for wedge %d°-%d° of (%.1f,%.1f), k=%.1f",
			w.Style.LineWidth, d, int(180*w.Phi/math.Pi), int(180*w.Psi/math.Pi), kx, ky, k)

		xi, yi := x+int(kx+0.5), y+int(ky+0.5)
		roc, ric := ro-int(d+k), ri-int(d+k)
		bg.Wedge(xi, yi, roc, ric, w.Phi, w.Psi, w.Style)

		if w.Text != "" {
			_, fh, _ := bg.FontMetrics(w.Font)
			fh += 0
			alpha := (w.Phi + w.Psi) / 2
			var rt int
			if ri > 0 {
				rt = (ri + ro) / 2
			} else {
				rt = ro - 3*fh
				if rt <= ro/2 {
					rt = ro - 2*fh
				}
			}
			// DebugLogger.Printf("Text %s at %d° r=%d", w.Text, int(180*alpha/math.Pi), rt)
			tx := int(float64(rt)*math.Cos(alpha)*eccentricity+0.5) + x
			ty := y + int(float64(rt)*math.Sin(alpha)+0.5)

			bg.Text(tx, ty, w.Text, "cc", 0, w.Font)
		}

	}

}

func GenericCircle(bg BasicGraphics, x, y, r int, style Style) {
	// TODO: fill
	x0, y0 := x+r, y
	rf := float64(r)
	for a := 0.2; a < 2*math.Pi; a += 0.2 {
		x1, y1 := int(rf*math.Cos(a))+x, int(rf*math.Sin(a))+y
		bg.Line(x0, y0, x1, y1, style)
		x0, y0 = x1, y1
	}
}

func polygon(bg BasicGraphics, x, y []int, style Style) {
	n := len(x) - 1
	for i := 0; i < n; i++ {
		bg.Line(x[i], y[i], x[i+1], y[i+1], style)
	}
	bg.Line(x[n], y[n], x[0], y[0], style)
}

func GenericSymbol(bg BasicGraphics, x, y int, style Style) {
	f := style.SymbolSize
	if f == 0 {
		f = 1
	}
	if style.LineWidth <= 0 {
		style.LineWidth = 1
	}

	if style.SymbolColor == nil {
		style.SymbolColor = style.LineColor
		if style.SymbolColor == nil {
			style.SymbolColor = style.FillColor
			if style.SymbolColor == nil {
				style.SymbolColor = color.NRGBA{0, 0, 0, 0xff}
			}
		}
	}

	style.LineColor = style.SymbolColor

	const n = 5               // default size
	a := int(n*f + 0.5)       // standard
	b := int(n/2*f + 0.5)     // smaller
	c := int(1.155*n*f + 0.5) // triangel long sist
	d := int(0.577*n*f + 0.5) // triangle short dist
	e := int(0.866*n*f + 0.5) // diagonal

	switch style.Symbol {
	case '*':
		bg.Line(x-e, y-e, x+e, y+e, style)
		bg.Line(x-e, y+e, x+e, y-e, style)
		fallthrough
	case '+':
		bg.Line(x-a, y, x+a, y, style)
		bg.Line(x, y-a, x, y+a, style)
	case 'X':
		bg.Line(x-e, y-e, x+e, y+e, style)
		bg.Line(x-e, y+e, x+e, y-e, style)
	case 'o':
		GenericCircle(bg, x, y, a, style)
	case '0':
		GenericCircle(bg, x, y, a, style)
		GenericCircle(bg, x, y, b, style)
	case '.':
		GenericCircle(bg, x, y, b, style)
	case '@':
		GenericCircle(bg, x, y, a, style)
		for r := 1; r < a; r++ {
			GenericCircle(bg, x, y, r, style)
		}
		bg.Line(x, y, x, y, style)
	case '=':
		bg.Rect(x-e, y-e, 2*e, 2*e, style)
	case '#':
		style.FillColor = style.LineColor
		bg.Rect(x-e, y-e, 2*e, 2*e, style)
	case 'A':
		polygon(bg, []int{x - a, x + a, x}, []int{y + d, y + d, y - c}, style)
		for j := 1; j < a; j++ {
			aa, dd, cc := (j*a)/a, (j*d)/a, (j*c)/a
			polygon(bg, []int{x - aa, x + aa, x}, []int{y + dd, y + dd, y - cc}, style)
		}
	case '%':
		polygon(bg, []int{x - a, x + a, x}, []int{y + d, y + d, y - c}, style)
	case 'W':
		polygon(bg, []int{x - a, x + a, x}, []int{y - c, y - c, y + d}, style)
		for j := 1; j < a; j++ {
			aa, dd, cc := (j*a)/a, (j*d)/a, (j*c)/a
			polygon(bg, []int{x - aa, x + aa, x}, []int{y - cc, y - cc, y + dd}, style)
		}
	case 'V':
		polygon(bg, []int{x - a, x + a, x}, []int{y - c, y - c, y + d}, style)
	case 'Z':
		polygon(bg, []int{x - e, x, x + e, x}, []int{y, y + e, y, y - e}, style)
		for j := 1; j < e; j++ {
			ee := (j * e) / e
			polygon(bg, []int{x - ee, x, x + ee, x}, []int{y, y + ee, y, y - ee}, style)
		}
	case '&':
		polygon(bg, []int{x - e, x, x + e, x}, []int{y, y + e, y, y - e}, style)
	default:
		bg.Text(x, y, "?", "cc", 0, Font{})
	}

}

func drawTitle(g Graphics, text string, style Style) {
	w, _ := g.Dimensions()
	_, fh, _ := g.FontMetrics(style.Font)
	x, y := w/2, fh/3
	g.Text(x, y, text, "tc", 0, style.Font)
}
