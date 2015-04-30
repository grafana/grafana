package chart

import (
	"fmt"
	"math"
	//	"os"
	//	"strings"
)

// BarChart draws simple bar charts.
// (Use CategoricalBarChart if your x axis is categorical, that is not numeric.)
//
// Stacking is on a "both bars have _identical_ x values" basis.
type BarChart struct {
	XRange, YRange Range
	Title          string      // Title of the chart
	Key            Key         // Key/Legend
	Horizontal     bool        // Display as horizontal bars (unimplemented)
	Stacked        bool        // Display different data sets ontop of each other (default is side by side)
	ShowVal        int         // Display values: 0: don't show; 1: above bar, 2: centerd in bar; 3: at top of bar
	SameBarWidth   bool        // all data sets use the same (smalest of all data sets) bar width
	BarWidthFac    float64     // if nonzero: scale determined bar width with this factor
	Options        PlotOptions // visual apperance, nil to use DefaultOptions
	Data           []BarChartData
}

// BarChartData encapsulates data sets in a bar chart.
type BarChartData struct {
	Name    string
	Style   Style
	Samples []Point
}

// AddData adds the data to the chart.
func (c *BarChart) AddData(name string, data []Point, style Style) {
	if len(c.Data) == 0 {
		c.XRange.init()
		c.YRange.init()
	}
	c.Data = append(c.Data, BarChartData{name, style, data})
	for _, d := range data {
		c.XRange.autoscale(d.X)
		c.YRange.autoscale(d.Y)
	}

	if name != "" {
		c.Key.Entries = append(c.Key.Entries, KeyEntry{Style: style, Text: name, PlotStyle: PlotStyleBox})
	}
}

// AddDataPair is a convenience method to add all the (x[i],y[i]) pairs to the chart.
func (c *BarChart) AddDataPair(name string, x, y []float64, style Style) {
	n := imin(len(x), len(y))
	data := make([]Point, n)
	for i := 0; i < n; i++ {
		data[i] = Point{X: x[i], Y: y[i]}
	}
	c.AddData(name, data, style)
}

func (c *BarChart) rescaleStackedY() {
	if !c.Stacked {
		return
	}

	// rescale y-axis
	high := make(map[float64]float64, 2*len(c.Data[0].Samples))
	low := make(map[float64]float64, 2*len(c.Data[0].Samples))
	min, max := c.YRange.DataMin, c.YRange.DataMax
	for _, d := range c.Data {
		for _, p := range d.Samples {
			x, y := p.X, p.Y
			if y == 0 {
				continue
			}
			if y > 0 {
				if cur, ok := high[x]; ok {
					high[x] = cur + y
				} else {
					high[x] = y
				}
				if high[x] > max {
					max = high[x]
				}
			} else {
				if cur, ok := low[x]; ok {
					low[x] = cur - y
				} else {
					low[x] = y
				}
				if low[x] < min {
					min = low[x]
				}
			}
		}
	}

	// stacked histograms and y-axis _not_ starting at 0 is
	// utterly braindamaged and missleading: Fix to 0 if
	// not spaning negativ to positive
	if min >= 0 {
		c.YRange.DataMin, c.YRange.Min = 0, 0
		c.YRange.MinMode.Fixed, c.YRange.MinMode.Value = true, 0
	} else {
		c.YRange.DataMin, c.YRange.Min = min, min
	}

	if max <= 0 {
		c.YRange.DataMax, c.YRange.Max = 0, 0
		c.YRange.MaxMode.Fixed, c.YRange.MaxMode.Value = true, 0
	} else {
		c.YRange.DataMax, c.YRange.Max = max, max
	}
}

// Reset chart to state before plotting.
func (c *BarChart) Reset() {
	c.XRange.Reset()
	c.YRange.Reset()
}

// Plot renders the chart to the graphics output g.
func (c *BarChart) Plot(g Graphics) {
	// layout
	layout := layout(g, c.Title, c.XRange.Label, c.YRange.Label,
		c.XRange.TicSetting.Hide || c.XRange.TicSetting.HideLabels,
		c.YRange.TicSetting.Hide || c.YRange.TicSetting.HideLabels,
		&c.Key)
	width, height := layout.Width, layout.Height
	topm, leftm := layout.Top, layout.Left
	numxtics, numytics := layout.NumXtics, layout.NumYtics
	font := elementStyle(c.Options, MajorAxisElement).Font
	fw, fh, _ := g.FontMetrics(font)
	fw += 0
	fh += 0

	// Outside bound ranges for bar plots are nicer
	leftm, width = leftm+int(2*fw), width-int(2*fw)
	topm, height = topm, height-fh

	c.rescaleStackedY()
	c.XRange.Setup(numxtics, numxtics+3, width, leftm, false)
	c.YRange.Setup(numytics, numytics+2, height, topm, true)

	// Start of drawing
	g.Begin()
	if c.Title != "" {
		drawTitle(g, c.Title, elementStyle(c.Options, TitleElement))
	}

	g.XAxis(c.XRange, topm+height+fh, topm, c.Options)
	g.YAxis(c.YRange, leftm-int(2*fw), leftm+width, c.Options)

	xf := c.XRange.Data2Screen
	yf := c.YRange.Data2Screen
	var sy0 int
	switch {
	case c.YRange.Min >= 0:
		sy0 = yf(c.YRange.Min)
	case c.YRange.Min < 0 && c.YRange.Max > 0:
		sy0 = yf(0)
	case c.YRange.Max <= 0:
		sy0 = yf(c.YRange.Max)
	default:
		fmt.Printf("No f.... idea how this can happen. You've been fiddeling?")
	}

	// TODO: gap between bars.
	var sbw, fbw int // ScreenBarWidth

	var low, high map[float64]float64
	if c.Stacked {
		high = make(map[float64]float64, 50)
		low = make(map[float64]float64, 50)
	}
	for dn, data := range c.Data {
		mindeltax := c.minimumSampleSep(dn)
		// DebugLogger.Printf("Minimum x-distance for set %d: %.3f\n", dn, mindeltax)
		if c.Stacked {
			sbw = (xf(2*mindeltax) - xf(0)) / 4
			fbw = sbw
		} else {
			//        V
			//   xxx === 000 ... xxx    sbw = 3
			//   xx == 00 ## .. xx ==   fbw = 11
			sbw = (xf(mindeltax)-xf(0))/(len(c.Data)+1) - 1
			fbw = len(c.Data)*sbw + len(c.Data) - 1
		}
		// DebugLogger.Printf("sbw = %d ,  fbw = %d\n", sbw, fbw)

		bars := make([]Barinfo, 0, len(data.Samples))
		if c.Stacked {
			for _, p := range data.Samples {
				if _, ok := high[p.X]; !ok {
					high[p.X], low[p.X] = 0, 0
				}
			}
		}
		for _, p := range data.Samples {
			x, y := p.X, p.Y
			if y == 0 {
				continue
			}

			sx := xf(x) - fbw/2
			if !c.Stacked {
				sx += dn * (sbw + 1)
			}

			var sy, sh int
			if c.Stacked {
				if y > 0 {
					top := y + high[x]
					sy = yf(top)
					sh = yf(high[x]) - sy
					high[x] = top

				} else {
					bot := low[x] + y
					sy = yf(low[x])
					sh = yf(bot) - sy
					low[x] = bot
				}
			} else {
				if y > 0 {
					sy = yf(y)
					sh = sy0 - sy
				} else {
					sy = sy0
					sh = yf(y) - sy0
				}
			}
			bar := Barinfo{x: sx, y: sy, w: sbw, h: sh}
			c.addLabel(&bar, y)
			bars = append(bars, bar)

		}
		g.Bars(bars, data.Style)

	}

	if !c.Key.Hide {
		g.Key(layout.KeyX, layout.KeyY, c.Key, c.Options)
	}

	g.End()

	/******** old code **************

	// find bar width
	lbw, ubw := c.extremBarWidth()
	var barWidth float64
	if c.SameBarWidth {
		barWidth = lbw
	} else {
		barWidth = ubw
	}

	// set up range and extend if bar would not fit
	c.XRange.Setup(numxtics, numxtics+4, width, leftm, false)
	c.YRange.Setup(numytics, numytics+2, height, topm, true)
	if c.XRange.DataMin-barWidth/2 < c.XRange.Min {
		c.XRange.DataMin -= barWidth / 2
	}
	if c.XRange.DataMax+barWidth > c.XRange.Max {
		c.XRange.DataMax += barWidth / 2
	}
	c.XRange.Setup(numxtics, numxtics+4, width, leftm, false)

	// Start of drawing
	g.Begin()
	if c.Title != "" {
		g.Title(c.Title)
	}

	g.XAxis(c.XRange, topm+height, topm)
	g.YAxis(c.YRange, leftm, leftm+width)

	xf := c.XRange.Data2Screen
	yf := c.YRange.Data2Screen
	sy0 := yf(c.YRange.Min)

	barWidth = lbw
	for i, data := range c.Data {
		if !c.SameBarWidth {
			barWidth = c.barWidth(i)
		}
		sbw := imax(1, xf(2*barWidth)-xf(barWidth)-1) // screen bar width TODO
		bars := make([]Barinfo, len(data.Samples))

		for i, point := range data.Samples {
			x, y := point.X, point.Y
			sx := xf(x-barWidth/2) + 1
			// sw := xf(x+barWidth/2) - sx
			sy := yf(y)
			sh := sy0 - sy
			bars[i].x, bars[i].y = sx, sy
			bars[i].w, bars[i].h = sbw, sh
		}
		g.Bars(bars, data.Style)
	}

	if !c.Key.Hide {
		g.Key(layout.KeyX, layout.KeyY, c.Key)
	}

	g.End()


	 **********************************************************/
}

func (c *BarChart) minimumSampleSep(d int) (min float64) {
	n := len(c.Data[d].Samples) - 1
	min = math.MaxFloat64

	for i := 0; i < n; i++ {
		sep := math.Abs(c.Data[d].Samples[i].X - c.Data[d].Samples[i+1].X)
		if sep < min {
			min = sep
		}
	}
	return
}

func (c *BarChart) addLabel(bar *Barinfo, y float64) {
	if c.ShowVal == 0 {
		return
	}

	var sval string
	if math.Abs(y) >= 100 {
		sval = fmt.Sprintf("%i", int(y+0.5))
	} else if math.Abs(y) >= 10 {
		sval = fmt.Sprintf("%.1f", y)
	} else if math.Abs(y) >= 1 {
		sval = fmt.Sprintf("%.2f", y)
	} else {
		sval = fmt.Sprintf("%.3f", y)
	}

	var tp string
	switch c.ShowVal {
	case 1:
		if y >= 0 {
			tp = "ot"
		} else {
			tp = "ob"
		}
	case 2:
		if y >= 0 {
			tp = "it"
		} else {
			tp = "ib"
		}
	case 3:
		tp = "c"
	}
	bar.t = sval
	bar.tp = tp
}
