package chart

import (
	"image/color"
	"math"
)

type HistChartData struct {
	Name    string
	Style   Style
	Samples []float64
}

// HistChart represents histogram charts.
//
// Histograms should not be mixed up with bar charts produced by BarChart:
// Histograms are computed (binified) automatically from the raw
// data.
type HistChart struct {
	XRange, YRange Range       // Lower limit of YRange is fixed to 0 and not available for input
	Title          string      // Title of chart
	Key            Key         // Key/Legend
	Counts         bool        // Display counts instead of frequencies
	Stacked        bool        // Display different data sets ontop of each other
	Shifted        bool        // Shift non-stacked bars sideways (and make them smaler)
	FirstBin       float64     // center of the first (lowest bin)
	BinWidth       float64     // Width of bins (0: auto)
	TBinWidth      TimeDelta   // BinWidth for time XRange
	Gap            float64     // gap between bins in (bin-width units): 0<=Gap<1,
	Sep            float64     // separation of bars in one bin (in bar width units) -1<Sep<1
	Kernel         Kernel      // Smoothing kernel (usable only for non-stacked histograms)
	Options        PlotOptions // general stylistic optins
	Data           []HistChartData
}

type Kernel func(x float64) float64

const sqrt2piinv = 0.39894228 // 1.0 / math.Sqrt(2.0*math.Pi)

// Some common smoothing kernels. All are identical 0 outside [-1,1[.
var (
	// 1/2
	RectangularKernel = func(x float64) float64 {
		if x >= -1 && x < 1 {
			return 0.5
		}
		return 0
	}

	// 1 - |x|
	TriangularKernel = func(x float64) float64 {
		if x >= -1 && x < 1 {
			return 1 - math.Abs(x)
		}
		return 0
	}

	// 15/16 * (1-x^2)^2
	BisquareKernel Kernel = func(x float64) float64 {
		if x >= -1 && x < 1 {
			a := (1 - x*x)
			return 15.0 / 16.0 * a * a
		}
		return 0
	}

	// 35/32 * (1-x^2)^3
	TriweightKernel Kernel = func(x float64) float64 {
		if x >= -1 && x < 1 {
			a := (1 - x*x)
			return 35.0 / 32.0 * a * a * a
		}
		return 0
	}

	// 3/4 * (1-x^2)
	EpanechnikovKernel Kernel = func(x float64) float64 {
		if x >= -1 && x < 1 {
			return 3.0 / 4.0 * (1.0 - x*x)
		}
		return 0
	}

	// 1/sqrt(2pi) * exp(-1/2x^2)
	GaussKernel Kernel = func(x float64) float64 {
		return sqrt2piinv * math.Exp(-0.5*x*x)
	}
)

// AddData will add data to the plot. Legend will be updated by name.
func (c *HistChart) AddData(name string, data []float64, style Style) {
	// Style
	if style.empty() {
		style = AutoStyle(len(c.Data), true)
	}

	// Init axis, add data, autoscale
	if len(c.Data) == 0 {
		c.XRange.init()
	}
	c.Data = append(c.Data, HistChartData{name, style, data})
	for _, d := range data {
		c.XRange.autoscale(d)
	}

	// Key/Legend
	if name != "" {
		c.Key.Entries = append(c.Key.Entries, KeyEntry{Text: name, Style: style, PlotStyle: PlotStyleBox})
	}
}

// AddDataInt is a convenience method to add integer data (a simple wrapper
// around AddData).
func (c *HistChart) AddDataInt(name string, data []int, style Style) {
	fdata := make([]float64, len(data))
	for i, d := range data {
		fdata[i] = float64(d)
	}
	c.AddData(name, fdata, style)
}

// AddDataGeneric is the generic version which allows the addition of any type
// implementing the Value interface.
func (c *HistChart) AddDataGeneric(name string, data []Value, style Style) {
	fdata := make([]float64, len(data))
	for i, d := range data {
		fdata[i] = d.XVal()
	}
	c.AddData(name, fdata, style)
}

// G = B * Gf;  S = W *Sf
// W = (B(1-Gf))/(N-(N-1)Sf)
// S = (B(1-Gf))/(N/Sf - (N-1))
// N   Gf    Sf
// 2   1/4  1/3
// 3   1/5  1/2
// 4   1/6  2/3
// 5   1/6  3/4
func (c *HistChart) widthFactor() (gf, sf float64) {
	if c.Stacked || !c.Shifted {
		gf = c.Gap
		sf = -1
		return
	}

	switch len(c.Data) {
	case 1:
		gf = c.Gap
		sf = -1
		return
	case 2:
		gf = 1.0 / 4.0
		sf = -1.0 / 3.0
	case 3:
		gf = 1.0 / 5.0
		sf = -1.0 / 2.0
	case 4:
		gf = 1.0 / 6.0
		sf = -2.0 / 3.0
	default:
		gf = 1.0 / 6.0
		sf = -2.0 / 4.0
	}

	if c.Gap != 0 {
		gf = c.Gap
	}
	if c.Sep != 0 {
		sf = c.Sep
	}
	return
}

// Prepare binCnt bins of width binWidth starting from binStart and count
// data samples per bin for each data set.  If c.Counts is true than the
// absolute counts are returned instead if the frequencies.  max is the
// largest y-value which will occur in our plot.
func (c *HistChart) binify(binStart, binWidth float64, binCnt int) (freqs [][]float64, max float64) {
	x2bin := func(x float64) int { return int((x - binStart) / binWidth) }

	freqs = make([][]float64, len(c.Data)) // freqs[d][b] is frequency/count of bin b in dataset d
	max = 0
	for i, data := range c.Data {
		freq := make([]float64, binCnt)
		drops := 0
		for _, x := range data.Samples {
			bin := x2bin(x)
			if bin < 0 || bin >= binCnt {
				// fmt.Printf("!!!!! Lost %.3f (bin=%d)\n", x, bin)
				drops++
				continue
			}
			freq[bin] = freq[bin] + 1
			//fmt.Printf("Value %.2f sorted into bin %d, count now %d\n", x, bin, int(freq[bin]))
		}
		// scale if requested and determine max
		n := float64(len(data.Samples) - drops)
		// DebugLogger.Printf("Dataset %d has %d samples (by %d drops).\n", i, int(n), drops)
		ff := 0.0
		for bin := 0; bin < binCnt; bin++ {
			if !c.Counts {
				freq[bin] = 100 * freq[bin] / n
			}
			ff += freq[bin]
			if freq[bin] > max {
				max = freq[bin]
			}
		}
		freqs[i] = freq
	}
	// DebugLogger.Printf("Maximum : %.2f\n", max)
	if c.Stacked { // recalculate max
		max = 0
		for bin := 0; bin < binCnt; bin++ {
			sum := 0.0
			for i := range freqs {
				sum += freqs[i][bin]
			}
			// fmt.Printf("sum of bin %d = %d\n", bin, sum)
			if sum > max {
				max = sum
			}
		}
		// DebugLogger.Printf("Re-Maxed (stacked) to: %.2f\n", max)
	}
	return
}

func (c *HistChart) findBinWidth() {
	bw := c.XRange.TicSetting.Delta
	if bw == 0 { // this should not happen...
		bw = 1
	}

	// Average sample count (n) and "optimum" bin count obc
	n := 0
	for _, data := range c.Data {
		for _, x := range data.Samples {
			// Count only data in valid x-range.
			if x >= c.XRange.Min && x <= c.XRange.Max {
				n++
			}
		}
	}
	n /= len(c.Data)
	obc := math.Sqrt(float64(n))
	// DebugLogger.Printf("Average size of %d data sets: %d (obc=%d)\n", len(c.Data), n, int(obc+0.5))

	// Increase/decrease bin width if tic delta yields massively bad choice
	binCnt := int((c.XRange.Max-c.XRange.Min)/bw + 0.5)
	if binCnt >= int(2*obc) {
		bw *= 2 // TODO: not so nice if bw is of form 2*10^n (use 2.5 in this case to match tics)
		//DebugLogger.Printf("Increased bin width to %.3f (optimum bin cnt = %d,  was %d).\n", bw, int(obc+0.5), binCnt)
	} else if binCnt < int(3*obc) {
		bw /= 2
		// DebugLogger.Printf("Reduced bin width to %.3f (optimum bin cnt = %d,  was %d).\n", bw, int(obc+0.5), binCnt)
	} else {
		// DebugLogger.Printf("Bin width of %.3f is ok (optimum bin cnt = %d,  was %d).\n", bw, int(obc+0.5), binCnt)
	}

	c.BinWidth = bw
}

// Reset chart to state before plotting.
func (c *HistChart) Reset() {
	c.XRange.Reset()
	c.YRange.Reset()
}

// Plot will output the chart to the graphic device g.
func (c *HistChart) Plot(g Graphics) {
	layout := layout(g, c.Title, c.XRange.Label, c.YRange.Label,
		c.XRange.TicSetting.Hide || c.XRange.TicSetting.HideLabels,
		c.YRange.TicSetting.Hide || c.YRange.TicSetting.HideLabels,
		&c.Key)
	fw, fh, _ := g.FontMetrics(elementStyle(c.Options, MajorAxisElement).Font)
	fw += 0

	width, height := layout.Width, layout.Height
	topm, leftm := layout.Top, layout.Left
	numxtics, numytics := layout.NumXtics, layout.NumYtics

	// Outside bound ranges for histograms are nicer
	leftm, width = leftm+int(2*fw), width-int(2*fw)
	topm, height = topm, height-int(1*fh)

	c.XRange.Setup(numxtics, numxtics+4, width, leftm, false)

	// TODO(vodo) a) BinWidth might be input, alignment to tics should be nice, binCnt, ...
	if c.BinWidth == 0 {
		c.findBinWidth()
	}

	xmin, _ := c.XRange.Min, c.XRange.Max
	binStart := c.BinWidth * math.Ceil(xmin/c.BinWidth)
	c.FirstBin = binStart + c.BinWidth/2
	binCnt := int(math.Floor(c.XRange.Max-binStart) / c.BinWidth)
	// DebugLogger.Printf("Using %d bins from %.3f to %.3f width %.3f  (xrange: %.3f--%.3f)\n", binCnt, binStart, binStart+c.BinWidth*float64(binCnt), c.BinWidth, xmin, xmax)
	counts, max := c.binify(binStart, c.BinWidth, binCnt)

	// Calculate smoothed density plots and re-max y.
	var smoothed [][]EPoint
	if !c.Stacked && c.Kernel != nil {
		smoothed = make([][]EPoint, len(c.Data))
		for d := range c.Data {
			p, m := c.smoothed(d, binCnt)
			smoothed[d] = p
			if m > max {
				max = m
			}
		}
	}

	// Fix lower end of y axis
	c.YRange.DataMin = 0
	c.YRange.MinMode.Fixed = true
	c.YRange.MinMode.Value = 0
	c.YRange.autoscale(float64(max))
	c.YRange.Setup(numytics, numytics+2, height, topm, true)

	g.Begin()

	if c.Title != "" {
		drawTitle(g, c.Title, elementStyle(c.Options, TitleElement))
	}

	g.XAxis(c.XRange, topm+height+fh, topm, c.Options)
	g.YAxis(c.YRange, leftm-int(2*fw), leftm+width, c.Options)

	xf := c.XRange.Data2Screen
	yf := c.YRange.Data2Screen

	numSets := len(c.Data)
	n := float64(numSets)
	gf, sf := c.widthFactor()

	ww := c.BinWidth * (1 - gf) // w'
	var w, s float64
	if !c.Stacked && c.Shifted {
		w = ww / (n + (n-1)*sf)
		s = w * sf
	} else {
		w = ww
		s = -ww
	}

	// DebugLogger.Printf("gf=%.3f, sf=%.3f, bw=%.3f   ===>  ww=%.2f,   w=%.2f,  s=%.2f\n", gf, sf, c.BinWidth, ww, w, s)

	if c.Shifted || c.Stacked {
		for d := numSets - 1; d >= 0; d-- {
			bars := make([]Barinfo, 0, binCnt)
			ws := 0
			for b := 0; b < binCnt; b++ {
				if counts[d][b] == 0 {
					continue
				}
				xb := binStart + (float64(b)+0.5)*c.BinWidth
				x := xb - ww/2 + float64(d)*(s+w)
				xs := xf(x)
				xss := xf(x + w)
				ws = xss - xs
				thebar := Barinfo{x: xs, w: xss - xs}

				off := 0.0
				if c.Stacked {
					for dd := d - 1; dd >= 0; dd-- {
						off += counts[dd][b]
					}
				}
				a, aa := yf(float64(off+counts[d][b])), yf(float64(off))
				thebar.y, thebar.h = a, iabs(a-aa)
				bars = append(bars, thebar)
			}
			g.Bars(bars, c.Data[d].Style)

			if !c.Stacked && sf < 0 && gf != 0 && fh > 1 {
				// Whitelining
				lw := 1
				if ws > 25 {
					lw = 2
				}
				white := Style{LineColor: color.NRGBA{0xff, 0xff, 0xff, 0xff}, LineWidth: lw, LineStyle: SolidLine}
				for _, b := range bars {
					g.Line(b.x, b.y-1, b.x+b.w+1, b.y-1, white)
					g.Line(b.x+b.w+1, b.y-1, b.x+b.w+1, b.y+b.h, white)
				}
			}
		}

	} else {
		bars := make([]Barinfo, 1)
		order := make([]int, numSets)
		for b := 0; b < binCnt; b++ {
			// shame on me...
			for d := 0; d < numSets; d++ {
				order[d] = d
			}
			for d := 0; d < numSets; d++ {
				for p := 0; p < numSets-1; p++ {
					if counts[order[p]][b] < counts[order[p+1]][b] {
						order[p], order[p+1] = order[p+1], order[p]
					}
				}
			}
			for d := 0; d < numSets; d++ {
				if counts[order[d]][b] == 0 {
					continue
				}
				xb := binStart + (float64(b)+0.5)*c.BinWidth
				x := xb - ww/2 + float64(d)*(s+w)
				xs := xf(x)
				xss := xf(x + w)
				thebar := Barinfo{x: xs, w: xss - xs}

				a, aa := yf(float64(counts[order[d]][b])), yf(0)
				thebar.y, thebar.h = a, iabs(a-aa)
				bars[0] = thebar
				g.Bars(bars, c.Data[order[d]].Style)
			}
		}
	}

	if !c.Stacked && c.Kernel != nil {
		for d := numSets - 1; d >= 0; d-- {
			style := Style{Symbol: /*c.Data[d].Style.Symbol*/ 'X', LineColor: c.Data[d].Style.LineColor,
				LineWidth: 1, LineStyle: SolidLine}
			for j := range smoothed[d] {
				// now YRange is set up: transform to screen coordinates
				smoothed[d][j].Y = float64(c.YRange.Data2Screen(smoothed[d][j].Y))
			}
			g.Scatter(smoothed[d], PlotStyleLines, style)
		}
	}

	if !c.Key.Hide {
		g.Key(layout.KeyX, layout.KeyY, c.Key, c.Options)
	}
	g.End()
}

// Smooth data set i. The Y-value of the returned points is not jet in screen coordinates
// but in data coordinates! (Reason: YRange not set up jet)
func (c *HistChart) smoothed(i, binCnt int) (points []EPoint, max float64) {
	nan := math.NaN()

	samples := imax(25, binCnt*5)

	step := (c.XRange.Max - c.XRange.Min) / float64(samples)
	points = make([]EPoint, 0, 50)
	h := c.BinWidth
	K := c.Kernel
	n := float64(len(c.Data[i].Samples))

	for x := c.XRange.Min; x <= c.XRange.Max; x += step {
		f := 0.0
		for _, xi := range c.Data[i].Samples {
			f += K((x - xi) / h)
		}
		f /= h
		if !c.Counts {
			f /= n
			f *= 100 // as display is in %
		}

		// Rescale kernel density estimation by width of bars:
		f *= c.BinWidth
		if f > max {
			max = f
		}
		xx := float64(c.XRange.Data2Screen(x))
		// yy := float64(c.YRange.Data2Screen(f))
		// fmt.Printf("Consructed %.3f, %.4f\n", x, f)
		points = append(points, EPoint{X: xx, Y: f, DeltaX: nan, DeltaY: nan})
	}
	// fmt.Printf("Dataset %d: ff=%.4f\n", i, ff)

	return
}
