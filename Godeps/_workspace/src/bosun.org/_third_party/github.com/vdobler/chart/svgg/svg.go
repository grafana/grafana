package svgg

import (
	"fmt"
	"image/color"
	"math"

	"bosun.org/_third_party/github.com/ajstarks/svgo"
	"bosun.org/_third_party/github.com/vdobler/chart"
)

// SvgGraphics implements BasicGraphics and uses the generic implementations
type SvgGraphics struct {
	svg    *svg.SVG
	w, h   int
	font   string
	fs     int
	bg     color.RGBA
	tx, ty int
}

// New creates a new SvgGraphics of dimension w x h, with a default font font of size fontsize.
func New(sp *svg.SVG, width, height int, font string, fontsize int, background color.RGBA) *SvgGraphics {
	if font == "" {
		font = "Helvetica"
	}
	if fontsize == 0 {
		fontsize = 12
	}
	s := SvgGraphics{svg: sp, w: width, h: height, font: font, fs: fontsize, bg: background}
	return &s
}

// AddTo returns a new ImageGraphics which will write to (width x height) sized
// area starting at (x,y) on the provided SVG
func AddTo(sp *svg.SVG, x, y, width, height int, font string, fontsize int, background color.RGBA) *SvgGraphics {
	s := New(sp, width, height, font, fontsize, background)
	s.tx, s.ty = x, y
	return s
}

func (sg *SvgGraphics) Options() chart.PlotOptions {
	return nil
}

func (sg *SvgGraphics) Begin() {
	font, fs := sg.font, sg.fs
	if font == "" {
		font = "Helvetica"
	}
	if fs == 0 {
		fs = 12
	}
	sg.svg.Gstyle(fmt.Sprintf("font-family: %s; font-size: %d",
		font, fs))
	if sg.tx != 0 || sg.ty != 0 {
		sg.svg.Gtransform(fmt.Sprintf("translate(%d %d)", sg.tx, sg.ty))
	}

	bgc := fmt.Sprintf("#%02x%02x%02x", sg.bg.R, sg.bg.G, sg.bg.B)
	opa := fmt.Sprintf("%.4f", float64(sg.bg.A)/255)
	bgs := fmt.Sprintf("stroke: %s; opacity: %s; fill: %s; fill-opacity: %s", bgc, opa, bgc, opa)
	sg.svg.Rect(0, 0, sg.w, sg.h, bgs)
}

func (sg *SvgGraphics) End() {
	sg.svg.Gend()
	if sg.tx != 0 || sg.ty != 0 {
		sg.svg.Gend()
	}
}

func (sg *SvgGraphics) Background() (r, g, b, a uint8) {
	return sg.bg.R, sg.bg.G, sg.bg.B, sg.bg.A
}

func (sg *SvgGraphics) Dimensions() (int, int) {
	return sg.w, sg.h
}

func (sg *SvgGraphics) fontheight(font chart.Font) (fh int) {
	if sg.fs <= 14 {
		fh = sg.fs + int(font.Size)
	} else if sg.fs <= 20 {
		fh = sg.fs + 2*int(font.Size)
	} else {
		fh = sg.fs + 3*int(font.Size)
	}

	if fh == 0 {
		fh = 12
	}
	return
}

func (sg *SvgGraphics) FontMetrics(font chart.Font) (fw float32, fh int, mono bool) {
	if font.Name == "" {
		font.Name = sg.font
	}
	fh = sg.fontheight(font)

	switch font.Name {
	case "Arial":
		fw, mono = 0.5*float32(fh), false
	case "Helvetica":
		fw, mono = 0.5*float32(fh), false
	case "Times":
		fw, mono = 0.51*float32(fh), false
	case "Courier":
		fw, mono = 0.62*float32(fh), true
	default:
		fw, mono = 0.75*float32(fh), false
	}

	// fmt.Printf("FontMetric of %s/%d: %.1f x %d  %t\n", style.Font, style.FontSize, fw, fh, mono)
	return
}

func (sg *SvgGraphics) TextLen(t string, font chart.Font) int {
	return chart.GenericTextLen(sg, t, font)
}

var dashlength [][]int = [][]int{[]int{}, []int{4, 1}, []int{1, 1}, []int{4, 1, 1, 1, 1, 1}, []int{4, 4}, []int{1, 3}}

func (sg *SvgGraphics) Line(x0, y0, x1, y1 int, style chart.Style) {
	s := linestyle(style)
	sg.svg.Line(x0, y0, x1, y1, s)
}

func (sg *SvgGraphics) Text(x, y int, t string, align string, rot int, f chart.Font) {
	if len(align) == 1 {
		align = "c" + align
	}
	_, fh, _ := sg.FontMetrics(f)

	trans := ""
	if rot != 0 {
		trans = fmt.Sprintf("transform=\"rotate(%d %d %d)\"", -rot, x, y)
	}

	// Hack because baseline alignments in svg often broken
	switch align[0] {
	case 'b':
		y += 0
	case 't':
		y += fh
	default:
		y += (4 * fh) / 10 // centered
	}
	s := "text-anchor:"
	switch align[1] {
	case 'l':
		s += "begin"
	case 'r':
		s += "end"
	default:
		s += "middle"
	}
	if f.Color != nil {
		s += "; fill:" + hexcol(f.Color)
	}
	if f.Name != "" {
		s += "; font-family:" + f.Name
	}
	if f.Size != 0 {
		s += fmt.Sprintf("; font-size: %d", fh)
	}

	sg.svg.Text(x, y, t, trans, s)
}

func (sg *SvgGraphics) Symbol(x, y int, style chart.Style) {
	st := ""
	filled := "fill:solid"
	empty := "fill:none"
	if style.SymbolColor != nil {
		st += "stroke:" + hexcol(style.SymbolColor)
		filled = "fill:" + hexcol(style.SymbolColor)
	}
	f := style.SymbolSize
	if f == 0 {
		f = 1
	}
	lw := 1
	if style.LineWidth > 1 {
		lw = style.LineWidth
	}

	const n = 5               // default size
	a := int(n*f + 0.5)       // standard
	b := int(n/2*f + 0.5)     // smaller
	c := int(1.155*n*f + 0.5) // triangel long sist
	d := int(0.577*n*f + 0.5) // triangle short dist
	e := int(0.866*n*f + 0.5) // diagonal

	sg.svg.Gstyle(fmt.Sprintf("%s; stroke-width: %d", st, lw))
	switch style.Symbol {
	case '*':
		sg.svg.Line(x-e, y-e, x+e, y+e)
		sg.svg.Line(x-e, y+e, x+e, y-e)
		fallthrough
	case '+':
		sg.svg.Line(x-a, y, x+a, y)
		sg.svg.Line(x, y-a, x, y+a)
	case 'X':
		sg.svg.Line(x-e, y-e, x+e, y+e)
		sg.svg.Line(x-e, y+e, x+e, y-e)
	case 'o':
		sg.svg.Circle(x, y, a, empty)
	case '0':
		sg.svg.Circle(x, y, a, empty)
		sg.svg.Circle(x, y, b, empty)
	case '.':
		if b >= 4 {
			b /= 2
		}
		sg.svg.Circle(x, y, b, empty)
	case '@':
		sg.svg.Circle(x, y, a, filled)
	case '=':
		sg.svg.Rect(x-e, y-e, 2*e, 2*e, empty)
	case '#':
		sg.svg.Rect(x-e, y-e, 2*e, 2*e, filled)
	case 'A':
		sg.svg.Polygon([]int{x - a, x + a, x}, []int{y + d, y + d, y - c}, filled)
	case '%':
		sg.svg.Polygon([]int{x - a, x + a, x}, []int{y + d, y + d, y - c}, empty)
	case 'W':
		sg.svg.Polygon([]int{x - a, x + a, x}, []int{y - c, y - c, y + d}, filled)
	case 'V':
		sg.svg.Polygon([]int{x - a, x + a, x}, []int{y - c, y - c, y + d}, empty)
	case 'Z':
		sg.svg.Polygon([]int{x - e, x, x + e, x}, []int{y, y + e, y, y - e}, filled)
	case '&':
		sg.svg.Polygon([]int{x - e, x, x + e, x}, []int{y, y + e, y, y - e}, empty)
	default:
		sg.svg.Text(x, y, "?", "text-anchor:middle; alignment-baseline:middle")
	}
	sg.svg.Gend()

}

func (sg *SvgGraphics) Rect(x, y, w, h int, style chart.Style) {
	var s string
	x, y, w, h = chart.SanitizeRect(x, y, w, h, style.LineWidth)
	linecol := style.LineColor
	if linecol != nil {
		s = fmt.Sprintf("stroke:%s; ", hexcol(linecol))
		s += fmt.Sprintf("stroke-opacity: %s; ", alpha(linecol))
	} else {
		s = "stroke:#808080; "
	}
	s += fmt.Sprintf("stroke-width: %d; ", style.LineWidth)
	if style.FillColor != nil {
		s += fmt.Sprintf("fill: %s; fill-opacity: %s", hexcol(style.FillColor), alpha(style.FillColor))
	} else {
		s += "fill-opacity: 0"
	}
	sg.svg.Rect(x, y, w, h, s)
	// GenericRect(sg, x, y, w, h, style) // TODO
}

func (sg *SvgGraphics) Path(x, y []int, style chart.Style) {
	n := len(x)
	if len(y) < n {
		n = len(y)
	}
	path := fmt.Sprintf("M %d,%d", x[0], y[0])
	for i := 1; i < n; i++ {
		path += fmt.Sprintf("L %d,%d", x[i], y[i])
	}
	st := linestyle(style)
	sg.svg.Path(path, st)
}

func (sg *SvgGraphics) Wedge(x, y, ro, ri int, phi, psi float64, style chart.Style) {
	panic("No Wedge() for SvgGraphics.")
}

func (sg *SvgGraphics) XAxis(xr chart.Range, ys, yms int, options chart.PlotOptions) {
	chart.GenericXAxis(sg, xr, ys, yms, options)
}
func (sg *SvgGraphics) YAxis(yr chart.Range, xs, xms int, options chart.PlotOptions) {
	chart.GenericYAxis(sg, yr, xs, xms, options)
}

func linestyle(style chart.Style) (s string) {
	lw := style.LineWidth
	if style.LineColor != nil {
		s = fmt.Sprintf("stroke:%s; ", hexcol(style.LineColor))
	}
	s += fmt.Sprintf("stroke-width: %d; fill:none; ", lw)
	s += fmt.Sprintf("opacity: %s; ", alpha(style.LineColor))
	if style.LineStyle != chart.SolidLine {
		s += fmt.Sprintf("stroke-dasharray:")
		for _, d := range dashlength[style.LineStyle] {
			s += fmt.Sprintf(" %d", d*lw)
		}
	}
	return
}

func (sg *SvgGraphics) Scatter(points []chart.EPoint, plotstyle chart.PlotStyle, style chart.Style) {
	chart.GenericScatter(sg, points, plotstyle, style)

	/***********************************************
	// First pass: Error bars
	ebs := style
	ebs.LineColor, ebs.LineWidth, ebs.LineStyle = ebs.FillColor, 1, chart.SolidLine
	if ebs.LineColor == "" {
		ebs.LineColor = "#404040"
	}
	if ebs.LineWidth == 0 {
		ebs.LineWidth = 1
	}
	for _, p := range points {
		xl, yl, xh, yh := p.BoundingBox()
		// fmt.Printf("Draw %d: %f %f-%f\n", i, p.DeltaX, xl,xh)
		if !math.IsNaN(p.DeltaX) {
			sg.Line(int(xl), int(p.Y), int(xh), int(p.Y), ebs)
		}
		if !math.IsNaN(p.DeltaY) {
			sg.Line(int(p.X), int(yl), int(p.X), int(yh), ebs)
		}
	}

	// Second pass: Line
	if (plotstyle&chart.PlotStyleLines) != 0 && len(points) > 0 {
		path := fmt.Sprintf("M %d,%d", int(points[0].X), int(points[0].Y))
		for i := 1; i < len(points); i++ {
			path += fmt.Sprintf("L %d,%d", int(points[i].X), int(points[i].Y))
		}
		st := linestyle(style)
		sg.svg.Path(path, st)
	}

	// Third pass: symbols
	if (plotstyle&chart.PlotStylePoints) != 0 && len(points) != 0 {
		for _, p := range points {
			sg.Symbol(int(p.X), int(p.Y), style)
		}
	}

	****************************************************/
}

func (sg *SvgGraphics) Boxes(boxes []chart.Box, width int, style chart.Style) {
	chart.GenericBoxes(sg, boxes, width, style)
}

func (sg *SvgGraphics) Key(x, y int, key chart.Key, options chart.PlotOptions) {
	chart.GenericKey(sg, x, y, key, options)
}

func (sg *SvgGraphics) Bars(bars []chart.Barinfo, style chart.Style) {
	chart.GenericBars(sg, bars, style)
}

func (sg *SvgGraphics) Rings(wedges []chart.Wedgeinfo, x, y, ro, ri int) {
	for _, w := range wedges {
		var s string
		linecol := w.Style.LineColor
		if linecol != nil {
			s = fmt.Sprintf("stroke:%s; ", hexcol(linecol))
			s += fmt.Sprintf("opacity: %s; ", alpha(linecol))
		} else {
			s = "stroke:%s; #808080; "
		}
		s += fmt.Sprintf("stroke-width: %d; ", w.Style.LineWidth)
		var sf string
		if w.Style.FillColor != nil {
			sf = fmt.Sprintf("fill: %s; fill-opacity: %s", hexcol(w.Style.FillColor), alpha(w.Style.FillColor))
		} else {
			sf = "fill-opacity: 0"
		}

		if math.Abs(w.Phi-w.Psi) >= 4*math.Pi {
			sg.svg.Circle(x, y, ro, s+sf)
			if ri > 0 {
				sf = "fill: #ffffff; fill-opacity: 1"
				sg.svg.Circle(x, y, ri, s+sf)
			}
			continue
		}

		var d string
		p := 0.4 * float64(w.Style.LineWidth+w.Shift)
		cphi, sphi := math.Cos(w.Phi), math.Sin(w.Phi)
		cpsi, spsi := math.Cos(w.Psi), math.Sin(w.Psi)

		if ri <= 0 {
			// real wedge drawn as center -> outer radius -> arc -> closed to center
			rf := float64(ro)
			a := math.Sin((w.Psi - w.Phi) / 2)
			dx, dy := p*math.Cos((w.Phi+w.Psi)/2)/a, p*math.Sin((w.Phi+w.Psi)/2)/a
			d = fmt.Sprintf("M %d,%d ", x+int(dx+0.5), y+int(dy+0.5))

			dx, dy = p*math.Cos(w.Phi+math.Pi/2), p*math.Sin(w.Phi+math.Pi/2)
			d += fmt.Sprintf("L %d,%d ", int(rf*cphi+0.5+dx)+x, int(rf*sphi+0.5+dy)+y)

			dx, dy = p*math.Cos(w.Psi-math.Pi/2), p*math.Sin(w.Psi-math.Pi/2)
			d += fmt.Sprintf("A %d,%d 0 0 1 %d,%d ", ro, ro, int(rf*cpsi+0.5+dx)+x, int(rf*spsi+0.5+dy)+y)
			d += fmt.Sprintf("z")
		} else {
			// ring drawn as inner radius -> outer radius -> outer arc -> inner radius -> inner arc
			rof, rif := float64(ro), float64(ri)
			dx, dy := p*math.Cos(w.Phi+math.Pi/2), p*math.Sin(w.Phi+math.Pi/2)
			a, b := int(rif*cphi+0.5+dx)+x, int(rif*sphi+0.5+dy)+y
			d = fmt.Sprintf("M %d,%d ", a, b)
			d += fmt.Sprintf("L %d,%d ", int(rof*cphi+0.5+dx)+x, int(rof*sphi+0.5+dy)+y)

			dx, dy = p*math.Cos(w.Psi-math.Pi/2), p*math.Sin(w.Psi-math.Pi/2)
			d += fmt.Sprintf("A %d,%d 0 0 1 %d,%d ", ro, ro, int(rof*cpsi+0.5+dx)+x, int(rof*spsi+0.5+dy)+y)
			d += fmt.Sprintf("L %d,%d ", int(rif*cpsi+0.5+dx)+x, int(rif*spsi+0.5+dy)+y)
			d += fmt.Sprintf("A %d,%d 0 0 0 %d,%d ", ri, ri, a, b)
			d += fmt.Sprintf("z")

		}

		sg.svg.Path(d, s+sf)

		if w.Text != "" {
			_, fh, _ := sg.FontMetrics(w.Font)
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
			tx, ty := int(float64(rt)*math.Cos(alpha)+0.5)+x, int(float64(rt)*math.Sin(alpha)+0.5)+y

			sg.Text(tx, ty, w.Text, "cc", 0, w.Font)
		}
	}
}

func hexcol(col color.Color) string {
	r, g, b, a := col.RGBA()
	if a == 0 {
		return "#000000" // doesn't matter as fully transparent
	}
	a = a >> 8
	r = ((r * 0xff) / a) >> 8
	g = ((g * 0xff) / a) >> 8
	b = ((b * 0xff) / a) >> 8
	return fmt.Sprintf("#%.2x%.2x%.2x", r, g, b)
}

func alpha(col color.Color) string {
	_, _, _, a := col.RGBA()
	return fmt.Sprintf("%.3f", float64(a)/0xffff)
}

var _ chart.Graphics = &SvgGraphics{}
