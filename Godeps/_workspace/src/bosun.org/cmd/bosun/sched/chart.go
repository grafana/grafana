package sched

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"time"

	"bosun.org/_third_party/github.com/MiniProfiler/go/miniprofiler"
	"bosun.org/_third_party/github.com/ajstarks/svgo"
	"bosun.org/_third_party/github.com/bradfitz/slice"
	"bosun.org/_third_party/github.com/vdobler/chart"
	"bosun.org/_third_party/github.com/vdobler/chart/imgg"
	"bosun.org/_third_party/github.com/vdobler/chart/svgg"
	"bosun.org/cmd/bosun/expr"
)

var chartColors = []color.Color{
	color.NRGBA{0xe4, 0x1a, 0x1c, 0xff},
	color.NRGBA{0x37, 0x7e, 0xb8, 0xff},
	color.NRGBA{0x4d, 0xaf, 0x4a, 0xff},
	color.NRGBA{0x98, 0x4e, 0xa3, 0xff},
	color.NRGBA{0xff, 0x7f, 0x00, 0xff},
	color.NRGBA{0xa6, 0x56, 0x28, 0xff},
	color.NRGBA{0xf7, 0x81, 0xbf, 0xff},
	color.NRGBA{0x99, 0x99, 0x99, 0xff},
}

// Autostyle styles a chart series.
func Autostyle(i int) chart.Style {
	c := chartColors[i%len(chartColors)]
	return chart.Style{
		// 0 uses a default
		SymbolSize: 0.00001,
		LineStyle:  chart.SolidLine,
		LineWidth:  1,
		LineColor:  c,
	}
}

var white = color.RGBA{0xff, 0xff, 0xff, 0xff}

func (s *Schedule) ExprSVG(t miniprofiler.Timer, w io.Writer, width, height int, res []*expr.Result, q string, now time.Time) error {
	ch, err := s.ExprGraph(t, res, q, now)
	if err != nil {
		return err
	}
	g := svg.New(w)
	g.StartviewUnit(100, 100, "%", 0, 0, width, height)
	g.Rect(0, 0, width, height, "fill: #ffffff")
	sgr := svgg.AddTo(g, 0, 0, width, height, "", 12, white)
	ch.Plot(sgr)
	g.End()
	return nil
}

func (s *Schedule) ExprPNG(t miniprofiler.Timer, w io.Writer, width, height int, res []*expr.Result, q string, now time.Time) error {
	ch, err := s.ExprGraph(t, res, q, now)
	if err != nil {
		return err
	}
	g := image.NewRGBA(image.Rectangle{Min: image.ZP, Max: image.Pt(width, height)})
	sgr := imgg.AddTo(g, 0, 0, width, height, white, nil, nil)
	ch.Plot(sgr)
	return png.Encode(w, g)
}

func (s *Schedule) ExprGraph(t miniprofiler.Timer, res []*expr.Result, q string, now time.Time) (chart.Chart, error) {
	c := chart.ScatterChart{
		Title: fmt.Sprintf("%s - %s", q, now.Format(time.RFC1123)),
		Key:   chart.Key{Pos: "itl"},
	}
	c.XRange.Time = true
	for ri, r := range res {
		rv := r.Value.(expr.Series)
		pts := make([]chart.EPoint, len(rv))
		idx := 0
		for k, v := range rv {
			pts[idx].X = float64(k.Unix())
			pts[idx].Y = v
			idx++
		}
		slice.Sort(pts, func(i, j int) bool {
			return pts[i].X < pts[j].X
		})
		c.AddData(r.Group.String(), pts, chart.PlotStyleLinesPoints, Autostyle(ri))
	}
	return &c, nil
}
