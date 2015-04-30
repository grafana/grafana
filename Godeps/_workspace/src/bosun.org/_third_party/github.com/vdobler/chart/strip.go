package chart

import (
	// "fmt"
	"math"
	"math/rand"
	//	"os"
	//	"strings"
)

// StripChart represents very simple strip charts.
type StripChart struct {
	Jitter       bool // Add jitter to help distinguish overlapping values
	ScatterChart      // The embeded ScatterChart is responsible for all drawing
}

// AddData adds data to the strip chart.
func (sc *StripChart) AddData(name string, data []float64, style Style) {
	n := len(sc.ScatterChart.Data) + 1
	pd := make([]EPoint, len(data))
	nan := math.NaN()
	for i, d := range data {
		pd[i].X = d
		pd[i].Y = float64(n)
		pd[i].DeltaX, pd[i].DeltaY = nan, nan
	}
	if style.empty() {
		style = AutoStyle(len(sc.Data), false)
	}
	style.LineStyle = 0
	sc.ScatterChart.AddData(name, pd, PlotStylePoints, style)
}

func (sc *StripChart) AddDataGeneric(name string, data []Value) {
	n := len(sc.ScatterChart.Data) + 1
	pd := make([]EPoint, len(data))
	nan := math.NaN()
	for i, d := range data {
		pd[i].X = d.XVal()
		pd[i].Y = float64(n)
		pd[i].DeltaX, pd[i].DeltaY = nan, nan
	}
	sc.ScatterChart.AddData(name, pd, PlotStylePoints, Style{})
}

// Reset chart to state before plotting.
func (sc *StripChart) Reset() {
	sc.ScatterChart.Reset()
}

// Plot outputs the strip chart sc to g.
func (sc *StripChart) Plot(g Graphics) {
	sc.ScatterChart.YRange.Label = ""
	sc.ScatterChart.YRange.TicSetting.Hide = true
	sc.ScatterChart.YRange.TicSetting.Delta = 1
	sc.ScatterChart.YRange.MinMode.Fixed = true
	sc.ScatterChart.YRange.MinMode.Value = 0.5
	sc.ScatterChart.YRange.MaxMode.Fixed = true
	sc.ScatterChart.YRange.MaxMode.Value = float64(len(sc.ScatterChart.Data)) + 0.5

	if sc.Jitter {
		// Set up ranging
		layout := layout(g, sc.Title, sc.XRange.Label, sc.YRange.Label,
			sc.XRange.TicSetting.Hide || sc.XRange.TicSetting.HideLabels,
			sc.YRange.TicSetting.Hide || sc.YRange.TicSetting.HideLabels,
			&sc.Key)

		_, height := layout.Width, layout.Height
		topm, _ := layout.Top, layout.Left
		_, numytics := layout.NumXtics, layout.NumYtics

		sc.YRange.Setup(numytics, numytics+1, height, topm, true)

		// amplitude of jitter: not too smal to be visible and useful, not to
		// big to be ugly or even overlapp other

		null := sc.YRange.Screen2Data(0)
		absmin := 1.4 * math.Abs(sc.YRange.Screen2Data(1)-null)           // would be one pixel
		tenpc := math.Abs(sc.YRange.Screen2Data(height)-null) / 10        // 10 percent of graph area
		smplcnt := len(sc.ScatterChart.Data) + 1                          //  as samples are borders
		noverlp := math.Abs(sc.YRange.Screen2Data(height/smplcnt) - null) // do not overlapp other sample

		yj := noverlp
		if tenpc < yj {
			yj = tenpc
		}
		if yj < absmin {
			yj = absmin
		}

		// yjs := sc.YRange.Data2Screen(yj) - sc.YRange.Data2Screen(0)
		// fmt.Printf("yj = %.2f : in screen = %d\n", yj, yjs)
		for _, data := range sc.ScatterChart.Data {
			if data.Samples == nil {
				continue // should not happen
			}
			for i := range data.Samples {
				shift := yj * rand.NormFloat64() * yj
				data.Samples[i].Y += shift
			}
		}
	}
	sc.ScatterChart.Plot(g)

	if sc.Jitter {
		// Revert Jitter
		for s, data := range sc.ScatterChart.Data {
			if data.Samples == nil {
				continue // should not happen
			}
			for i, _ := range data.Samples {
				data.Samples[i].Y = float64(s + 1)
			}
		}
	}
}
