package chart

import (
	"image/color"
	"math"
	// "fmt"
	//	"os"
	//	"strings"
)

// BoxChart represents box charts.
//
// To faciliate standard use of box plots, the method AddSet() exists which will
// calculate the various elents of a box (e.g. med, q3, outliers, ...) from raw
// data.
type BoxChart struct {
	XRange, YRange Range  // x and y axis
	Title          string // Title of the chart
	Key            Key    // Key/legend
	Options        PlotOptions
	Data           []BoxChartData // the data sets to draw
}

// BoxChartData encapsulates a data set in a box chart
type BoxChartData struct {
	Name    string
	Style   Style
	Samples []Box
}

// AddData adds all boxes in data to the chart.
func (c *BoxChart) AddData(name string, data []Box, style Style) {
	c.Data = append(c.Data, BoxChartData{name, style, data})
	ps := PlotStyle(PlotStylePoints | PlotStyleBox)
	c.Key.Entries = append(c.Key.Entries, KeyEntry{Text: name, Style: style, PlotStyle: ps})
	// TODO(vodo) min, max
}

// NextDataSet adds a new (empty) data set to chart.  After adding the data set you
// can fill this last data set with AddSet()
func (c *BoxChart) NextDataSet(name string, style Style) {
	c.Data = append(c.Data, BoxChartData{name, style, nil})
	ps := PlotStyle(PlotStylePoints | PlotStyleBox)
	c.Key.Entries = append(c.Key.Entries, KeyEntry{Text: name, Style: style, PlotStyle: ps})
}

// AddSet will add to last data set in the chart one new box calculated from data.
// If outlier is true, than outliers (1.5*IQR from 25/75 percentil) are
// drawn. If outlier is false, than the wiskers extend from min to max.
func (c *BoxChart) AddSet(x float64, data []float64, outlier bool) {
	min, lq, med, avg, uq, max := SixvalFloat64(data, 25)
	b := Box{X: x, Avg: avg, Med: med, Q1: lq, Q3: uq, Low: min, High: max}

	if len(c.Data) == 0 {
		c.Data = make([]BoxChartData, 1)
		st := Style{LineColor: color.NRGBA{0, 0, 0, 0xff}, LineWidth: 1, LineStyle: SolidLine}
		c.Data[0] = BoxChartData{Name: "", Style: st}
	}

	if len(c.Data) == 1 && len(c.Data[0].Samples) == 0 {
		c.XRange.DataMin, c.XRange.DataMax = x, x
		c.YRange.DataMin, c.YRange.DataMax = min, max
	} else {
		if x < c.XRange.DataMin {
			c.XRange.DataMin = x
		} else if x > c.XRange.DataMax {
			c.XRange.DataMax = x
		}
		if min < c.YRange.DataMin {
			c.YRange.DataMin = min
		}
		if max > c.YRange.DataMax {
			c.YRange.DataMax = max
		}
	}

	if outlier {
		outliers := make([]float64, 0)
		iqr := uq - lq
		min, max = max, min
		for _, d := range data {
			if d > uq+1.5*iqr || d < lq-1.5*iqr {
				outliers = append(outliers, d)
			}
			if d > max && d <= uq+1.5*iqr {
				max = d
			}
			if d < min && d >= lq-1.5*iqr {
				min = d
			}
		}
		b.Low, b.High, b.Outliers = min, max, outliers
	}
	j := len(c.Data) - 1
	c.Data[j].Samples = append(c.Data[j].Samples, b)
}

// Reset chart to state before plotting.
func (c *BoxChart) Reset() {
	c.XRange.Reset()
	c.YRange.Reset()
}

// Plot renders the chart to the graphic output g.
func (c *BoxChart) Plot(g Graphics) {
	// layout
	layout := layout(g, c.Title, c.XRange.Label, c.YRange.Label,
		c.XRange.TicSetting.Hide || c.XRange.TicSetting.HideLabels,
		c.YRange.TicSetting.Hide || c.YRange.TicSetting.HideLabels,
		&c.Key)
	width, height := layout.Width, layout.Height
	topm, leftm := layout.Top, layout.Left
	numxtics, numytics := layout.NumXtics, layout.NumYtics
	// fontwidth, fontheight, _ := g.FontMetrics(DataStyle{})

	g.Begin()

	c.XRange.Setup(numxtics, numxtics+2, width, leftm, false)
	c.YRange.Setup(numytics, numytics+1, height, topm, true)

	if c.Title != "" {
		drawTitle(g, c.Title, elementStyle(c.Options, TitleElement))
	}

	g.XAxis(c.XRange, topm+height, topm, c.Options)
	g.YAxis(c.YRange, leftm, leftm+width, c.Options)

	yf := c.YRange.Data2Screen
	nan := math.NaN()
	for _, data := range c.Data {
		// Samples
		nums := len(data.Samples)
		bw := width / (2*nums - 1)

		boxes := make([]Box, len(data.Samples))
		for i, d := range data.Samples {
			x := float64(c.XRange.Data2Screen(d.X))
			// DebugLogger.Printf("Q1=%.2f  Q3=%.3f", d.Q1, d.Q3)
			q1, q3 := float64(yf(d.Q1)), float64(yf(d.Q3))
			med, avg := nan, nan
			high, low := nan, nan
			if !math.IsNaN(d.Med) {
				med = float64(yf(d.Med))
			}
			if !math.IsNaN(d.Avg) {
				avg = float64(yf(d.Avg))
			}
			if !math.IsNaN(d.High) {
				high = float64(yf(d.High))
			}
			if !math.IsNaN(d.Low) {
				low = float64(yf(d.Low))
			}

			outliers := make([]float64, len(d.Outliers))
			for j, ol := range d.Outliers {
				outliers[j] = float64(c.YRange.Data2Screen(ol))
			}
			boxes[i].X = x
			boxes[i].Q1 = q1
			boxes[i].Q3 = q3
			boxes[i].Med = med
			boxes[i].Avg = avg
			boxes[i].High = high
			boxes[i].Low = low
			boxes[i].Outliers = outliers
		}
		g.Boxes(boxes, bw, data.Style)
	}

	if !c.Key.Hide {
		g.Key(layout.KeyX, layout.KeyY, c.Key, c.Options)
	}

	g.End()
}
