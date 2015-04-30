package chart_test

import (
	"fmt"
	"image/color"
	"math"
	"testing"

	"bosun.org/_third_party/github.com/vdobler/chart"
	"bosun.org/_third_party/github.com/vdobler/chart/txtg"
)

const r = 18
const ri = 10

func initDemoCircle() *txtg.TextGraphics {
	g := txtg.New(60, 40)
	g.Line(0, 20, 59, 20, chart.Style{Symbol: '-'})
	g.Line(30, 0, 30, 39, chart.Style{Symbol: '|'})
	for p := 0.0; p <= 2*math.Pi; p += 0.1 {
		x := int(r * math.Cos(p) * 1.5)
		y := int(r * math.Sin(p))
		g.Symbol(30+x, 20+y, chart.Style{Symbol: '*'})
	}
	return g
}

func TestGenericWedge(t *testing.T) {
	g := initDemoCircle()
	red, blue := color.RGBA{0xff, 0, 0, 0}, color.RGBA{0, 0, 0xff, 0}
	s := chart.Style{Symbol: '#', FillColor: red, LineColor: blue}
	ra := math.Pi / 2

	chart.GenericWedge(g, 30, 20, r, ri, 0.15*ra, 0.5*ra, 1.5, s)
	fmt.Printf("\n%s\n", g.String())

	chart.GenericWedge(g, 30, 20, r, ri, 1.15*ra, 1.5*ra, 1.5, s)
	fmt.Printf("\n%s\n", g.String())

	chart.GenericWedge(g, 30, 20, r, ri, 2.15*ra, 2.5*ra, 1.5, s)
	fmt.Printf("\n%s\n", g.String())

	chart.GenericWedge(g, 30, 20, r, ri, 3.15*ra, 3.5*ra, 1.5, s)
	fmt.Printf("\n%s\n", g.String())

	// mored than one quadrant
	g = initDemoCircle()
	chart.GenericWedge(g, 30, 20, r, ri, 0.15*ra, 1.5*ra, 1.5, s)
	fmt.Printf("\n%s\n", g.String())

	chart.GenericWedge(g, 30, 20, r, ri, 2.15*ra, 3.5*ra, 1.5, s)
	fmt.Printf("\n%s\n", g.String())

	g = initDemoCircle()
	chart.GenericWedge(g, 30, 20, r, ri, 1.5*ra, 2.5*ra, 1.5, s)
	fmt.Printf("\n%s\n", g.String())

	// all 4 quadrants
	g = initDemoCircle()
	chart.GenericWedge(g, 30, 20, r, ri, 1.5*ra, 0.5*ra, 1.5, s)
	fmt.Printf("\n%s\n", g.String())

}
