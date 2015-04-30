package chart

import (
	"math"
)

// ScatterChart represents scatter charts, line charts and function plots.
type ScatterChart struct {
	XRange, YRange Range  // X and Y axis
	Title          string // Title of the chart
	Key            Key    // Key/Legend
	Options        PlotOptions
	Data           []ScatterChartData // The actual data (filled with Add...-methods)
	NSamples       int                // number of samples for function plots
}

// ScatterChartData encapsulates a data set or function in a scatter chart.
// Not both Samples and Func may be non nil at the same time.
type ScatterChartData struct {
	Name      string                // The name of this data set. TODO: unused?
	PlotStyle PlotStyle             // Points, Lines+Points or Lines only
	Style     Style                 // Color, sizes, pointtype, linestyle, ...
	Samples   []EPoint              // The actual points for scatter/lines charts
	Func      func(float64) float64 // The function to draw.
}

// AddFunc adds a function f to this chart. A key/legend entry is produced
// if name is not empty.
func (c *ScatterChart) AddFunc(name string, f func(float64) float64, plotstyle PlotStyle, style Style) {
	if plotstyle.undefined() {
		plotstyle = PlotStyleLines
	}
	if style.empty() {
		style = AutoStyle(len(c.Data), false)
	}

	scd := ScatterChartData{Name: name, PlotStyle: plotstyle, Style: style, Samples: nil, Func: f}
	c.Data = append(c.Data, scd)
	if name != "" {
		ke := KeyEntry{Text: name, PlotStyle: plotstyle, Style: style}
		c.Key.Entries = append(c.Key.Entries, ke)
	}
}

// AddData adds points in data to chart. A key/legend entry is produced
// if name is not empty.
func (c *ScatterChart) AddData(name string, data []EPoint, plotstyle PlotStyle, style Style) {

	// Update styles if non given
	if plotstyle.undefined() {
		plotstyle = PlotStylePoints
	}
	if style.empty() {
		style = AutoStyle(len(c.Data), false)
	}
	// Fix missing values in style
	if (plotstyle & PlotStyleLines) != 0 {
		if style.LineWidth <= 0 {
			style.LineWidth = 1
		}
		if style.LineColor == nil {
			style.LineColor = style.SymbolColor
		}
	}
	if (plotstyle&PlotStylePoints) != 0 && style.Symbol == 0 {
		style.Symbol = '#'
	}

	// Init axis
	if len(c.Data) == 0 {
		c.XRange.init()
		c.YRange.init()
	}

	// Add data
	scd := ScatterChartData{Name: name, PlotStyle: plotstyle, Style: style, Samples: data, Func: nil}
	c.Data = append(c.Data, scd)

	// Autoscale
	for _, d := range data {
		xl, yl, xh, yh := d.BoundingBox()
		c.XRange.autoscale(xl)
		c.XRange.autoscale(xh)
		c.YRange.autoscale(yl)
		c.YRange.autoscale(yh)
	}

	// Add key/legend entry
	if name != "" {
		ke := KeyEntry{Style: style, PlotStyle: plotstyle, Text: name}
		c.Key.Entries = append(c.Key.Entries, ke)
	}
}

// AddDataGeneric is the generiv version of AddData which allows any type
// to be plotted that implements the XYErrValue interface.
func (c *ScatterChart) AddDataGeneric(name string, data []XYErrValue, plotstyle PlotStyle, style Style) {
	edata := make([]EPoint, len(data))
	for i, d := range data {
		x, y := d.XVal(), d.YVal()
		xl, xh := d.XErr()
		yl, yh := d.YErr()
		dx, dy := xh-xl, yh-yl
		xo, yo := xh-dx/2-x, yh-dy/2-y
		edata[i] = EPoint{X: x, Y: y, DeltaX: dx, DeltaY: dy, OffX: xo, OffY: yo}
	}
	c.AddData(name, edata, plotstyle, style)
}

// AddDataPair is a convenience method which wrapps around AddData: It adds the points
// (x[n],y[n]) to the chart.
func (c *ScatterChart) AddDataPair(name string, x, y []float64, plotstyle PlotStyle, style Style) {
	n := imin(len(x), len(y))
	data := make([]EPoint, n)
	nan := math.NaN()
	for i := 0; i < n; i++ {
		data[i] = EPoint{X: x[i], Y: y[i], DeltaX: nan, DeltaY: nan}
	}
	c.AddData(name, data, plotstyle, style)
}

// Reset chart to state before plotting.
func (c *ScatterChart) Reset() {
	c.XRange.Reset()
	c.YRange.Reset()
}

// Plot outputs the scatter chart to the graphic output g.
func (c *ScatterChart) Plot(g Graphics) {
	layout := layout(g, c.Title, c.XRange.Label, c.YRange.Label,
		c.XRange.TicSetting.Hide || c.XRange.TicSetting.HideLabels,
		c.YRange.TicSetting.Hide || c.YRange.TicSetting.HideLabels,
		&c.Key)

	width, height := layout.Width, layout.Height
	topm, leftm := layout.Top, layout.Left
	numxtics, numytics := layout.NumXtics, layout.NumYtics

	// fmt.Printf("\nSet up of X-Range (%d)\n", numxtics)
	c.XRange.Setup(numxtics, numxtics+2, width, leftm, false)
	// fmt.Printf("\nSet up of Y-Range (%d)\n", numytics)
	c.YRange.Setup(numytics, numytics+2, height, topm, true)

	g.Begin()

	if c.Title != "" {
		drawTitle(g, c.Title, elementStyle(c.Options, TitleElement))
	}

	g.XAxis(c.XRange, topm+height, topm, c.Options)
	g.YAxis(c.YRange, leftm, leftm+width, c.Options)

	// Plot Data
	xf, yf := c.XRange.Data2Screen, c.YRange.Data2Screen
	xmin, xmax := c.XRange.Min, c.XRange.Max
	ymin, ymax := c.YRange.Min, c.YRange.Max
	spf := screenPointFunc(xf, yf, xmin, xmax, ymin, ymax)

	for i, data := range c.Data {
		style := data.Style
		if data.Samples != nil {
			// Samples
			points := make([]EPoint, 0, len(data.Samples))
			for _, d := range data.Samples {
				if d.X < xmin || d.X > xmax || d.Y < ymin || d.Y > ymax {
					continue
				}
				p := spf(d)
				points = append(points, p)
			}
			g.Scatter(points, data.PlotStyle, style)
		} else if data.Func != nil {
			c.drawFunction(g, i)
		}
	}

	if !c.Key.Hide {
		g.Key(layout.KeyX, layout.KeyY, c.Key, c.Options)
	}

	g.End()
}

// Output function (ih in Data)
func (c *ScatterChart) drawFunction(g Graphics, i int) {
	function := c.Data[i].Func
	style := c.Data[i].Style
	plotstyle := c.Data[i].PlotStyle

	yf := c.YRange.Data2Screen
	symax, symin := float64(yf(c.YRange.Min)), float64(yf(c.YRange.Max)) // y limits in screen coords
	sxmin, sxmax := c.XRange.Data2Screen(c.XRange.Min), c.XRange.Data2Screen(c.XRange.Max)
	width := sxmax - sxmin
	if c.NSamples == 0 {
		step := 6
		if width < 70 {
			step = 3
		}
		if width < 50 {
			step = 2
		}
		if width < 30 {
			step = 1
		}
		c.NSamples = width / step
	}
	step := width / c.NSamples
	if step < 1 {
		step = 1
	}
	pcap := width/step + 2
	points := make([]EPoint, 0, pcap)
	var lastP *EPoint = nil // screen coordinates of last point (nil if no point)
	var lastIn bool = false // was last point in valid yrange? (undef if lastP==nil)

	for six := sxmin; six < sxmax; six += step {
		x := c.XRange.Screen2Data(six)
		sx := float64(six)
		y := function(x)

		// Handle NaN and +/- Inf
		if math.IsNaN(y) {
			g.Scatter(points, plotstyle, style)
			points = points[0:0]
			lastP = nil
			continue
		}

		sy := float64(yf(y))

		if sy >= symin && sy <= symax {
			p := EPoint{X: sx, Y: sy}
			if lastP != nil && !lastIn {
				pc := c.clipPoint(p, *lastP, symin, symax)
				// fmt.Printf("Added front clip point %v\n", pc)
				points = append(points, pc)
			}
			// fmt.Printf("Added point %v\n", p)
			points = append(points, p)
			lastIn = true
		} else {
			if lastP == nil {
				lastP = &EPoint{X: sx, Y: sy}
				continue
			}
			if lastIn {
				pc := c.clipPoint(*lastP, EPoint{X: sx, Y: sy}, symin, symax)
				points = append(points, pc)
				g.Scatter(points, plotstyle, style)
				// fmt.Printf("Added clip point %v and drawing\n", pc)
				points = points[0:0]
				lastIn = false
			} else if (lastP.Y < symin && sy > symax) || (lastP.Y > symax && sy < symin) {
				p2 := c.clip2Point(*lastP, EPoint{X: sx, Y: sy}, symin, symax)
				// fmt.Printf("Added 2clip points %v / %v and drawing\n", p2[0], p2[1])
				g.Scatter(p2, plotstyle, style)
			}

		}

		lastP = &EPoint{X: sx, Y: sy}
	}
	g.Scatter(points, plotstyle, style)
}

// Point in is in valid y range, out is out. Return p which clips the line from in to out to valid y range
func (c *ScatterChart) clipPoint(in, out EPoint, min, max float64) (p EPoint) {
	// fmt.Printf("clipPoint: in (%g,%g), out(%g,%g)  min/max=%g/%g\n", in.X, in.Y, out.X, out.Y, min, max)
	dx, dy := in.X-out.X, in.Y-out.Y

	var y float64
	if out.Y <= min {
		y = min
	} else {
		y = max
	}
	x := in.X + dx*(y-in.Y)/dy
	p.X, p.Y = x, y
	p.DeltaX, p.DeltaY = math.NaN(), math.NaN()
	return
}

// Clip line from a to b (both outside min/max range)
func (c *ScatterChart) clip2Point(a, b EPoint, min, max float64) []EPoint {
	if a.Y > b.Y {
		a, b = b, a
	}
	dx, dy := b.X-a.X, b.Y-a.Y
	s := dx / dy

	pc := make([]EPoint, 2)

	pc[0].X = a.X + s*(min-a.Y)
	pc[0].Y = min
	pc[0].DeltaX, pc[0].DeltaY = math.NaN(), math.NaN()
	pc[1].X = a.X + s*(max-a.Y)
	pc[1].Y = max
	pc[1].DeltaX, pc[1].DeltaY = math.NaN(), math.NaN()
	return pc
}

// Set up function which handles mappig data->screen coordinates and does
// proper clipping on the error bars.
func screenPointFunc(xf, yf func(float64) int, xmin, xmax, ymin, ymax float64) (spf func(EPoint) EPoint) {
	spf = func(d EPoint) (p EPoint) {
		xl, yl, xh, yh := d.BoundingBox()
		// fmt.Printf("OrigBB: %.1f %.1f %.1f %.1f  (%.1f,%.1f)\n", xl,yl,xh,yh,d.X,d.Y)
		if xl < xmin {
			xl = xmin
		}
		if xh > xmax {
			xh = xmax
		}
		if yl < ymin {
			yl = ymin
		}
		if yh > ymax {
			yh = ymax
		}
		// fmt.Printf("ClippedBB: %.1f %.1f %.1f %.1f\n", xl,yl,xh,yh)

		x := float64(xf(d.X))
		y := float64(yf(d.Y))
		xsl, xsh := float64(xf(xl)), float64(xf(xh))
		ysl, ysh := float64(yf(yl)), float64(yf(yh))
		// fmt.Printf("ScreenBB: %.0f %.0f %.0f %.0f   (%.0f,%.0f)\n", xsl,ysl,xsh,ysh,x,y)

		dx, dy := math.NaN(), math.NaN()
		var xo, yo float64

		if xsl != xsh {
			dx = math.Abs(xsh - xsl)
			xo = xsl - x + dx/2
		}
		if ysl != ysh {
			dy = math.Abs(ysh - ysl)
			yo = ysh - y + dy/2
		}
		// fmt.Printf("  >> dx=%.0f  dy=%.0f   xo=%.0f  yo=%.0f\n", dx,dy,xo,yo)

		p = EPoint{X: x, Y: y, DeltaX: dx, DeltaY: dy, OffX: xo, OffY: yo}
		return

		/**************************
		if xl < xmin { // happens only if d.Delta!=0,NaN
			a := xmin - xl
			d.DeltaX -= a
			d.OffX += a / 2
		}
		if xh > xmax {
			a := xh - xmax
			d.DeltaX -= a
			d.OffX -= a / 2
		}
		if yl < ymin { // happens only if d.Delta!=0,NaN
			a := ymin - yl
			d.DeltaY -= a
			d.OffY += a / 2
		}
		if yh > ymax {
			a := yh - ymax
			d.DeltaY -= a
			d.OffY -= a / 2
		}

		x := xf(d.X)
		y := yf(d.Y)
		dx, dy := math.NaN(), math.NaN()
		var xo, yo float64
		if !math.IsNaN(d.DeltaX) {
			dx = float64(xf(d.DeltaX) - xf(0)) // TODO: abs?
			xo = float64(xf(d.OffX) - xf(0))
		}
		if !math.IsNaN(d.DeltaY) {
			dy = float64(yf(d.DeltaY) - yf(0)) // TODO: abs?
			yo = float64(yf(d.OffY) - yf(0))
		}
		// fmt.Printf("Point %d: %f\n", i, dx)
		p = EPoint{X: float64(x), Y: float64(y), DeltaX: dx, DeltaY: dy, OffX: xo, OffY: yo}
		return
		 *********************/
	}
	return
}
