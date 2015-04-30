package chart

import (
	"fmt"
	"image/color"
	"math"
)

// Symbol is the list of different symbols.
var Symbol = []int{
	'o', // empty circle
	'=', // empty square
	'%', // empty triangle up
	'&', // empty diamond
	'+', // plus
	'X', // cross
	'*', // star
	'0', // bulls eys
	'@', // filled circle
	'#', // filled square
	'A', // filled triangle up
	'W', // filled triangle down
	'V', // empty triangle down
	'Z', // filled diamond
	'.', // tiny dot
}

// SymbolIndex returns the index of the symbol s in Symbol or -1 if not found.
func SymbolIndex(s int) (idx int) {
	for idx = 0; idx < len(Symbol); idx++ {
		if Symbol[idx] == s {
			return idx
		}
	}
	return -1
}

// NextSymbol returns the next symbol of s: Either in the global list Symbol
// or (if not found there) the next character.
func NextSymbol(s int) int {
	if idx := SymbolIndex(s); idx != -1 {
		return Symbol[(idx+1)%len(Symbol)]
	}
	return s + 1
}

// CharacterWidth is a table of the (relative) width of common runes.
var CharacterWidth = map[int]float32{'a': 16.8, 'b': 17.0, 'c': 15.2, 'd': 16.8, 'e': 16.8, 'f': 8.5, 'g': 17.0,
	'h': 16.8, 'i': 5.9, 'j': 5.9, 'k': 16.8, 'l': 6.9, 'm': 25.5, 'n': 16.8, 'o': 16.8, 'p': 17.0, 'q': 17.0,
	'r': 10.2, 's': 15.2, 't': 8.4, 'u': 16.8, 'v': 15.4, 'w': 22.2, 'x': 15.2, 'y': 15.2, 'z': 15.2,
	'A': 20.2, 'B': 20.2, 'C': 22.2, 'D': 22.2, 'E': 20.2, 'F': 18.6, 'G': 23.5, 'H': 22.0, 'I': 8.2, 'J': 15.2,
	'K': 20.2, 'L': 16.8, 'M': 25.5, 'N': 22.0, 'O': 23.5, 'P': 20.2, 'Q': 23.5, 'R': 21.1, 'S': 20.2, 'T': 18.5,
	'U': 22.0, 'V': 20.2, 'W': 29.0, 'X': 20.2, 'Y': 20.2, 'Z': 18.8, ' ': 8.5,
	'1': 16.8, '2': 16.8, '3': 16.8, '4': 16.8, '5': 16.8, '6': 16.8, '7': 16.8, '8': 16.8, '9': 16.8, '0': 16.8,
	'.': 8.2, ',': 8.2, ':': 8.2, ';': 8.2, '+': 17.9, '"': 11.0, '*': 11.8, '%': 27.0, '&': 20.2, '/': 8.4,
	'(': 10.2, ')': 10.2, '=': 18.0, '?': 16.8, '!': 8.5, '[': 8.2, ']': 8.2, '{': 10.2, '}': 10.2, '$': 16.8,
	'<': 18.0, '>': 18.0, '§': 16.8, '°': 12.2, '^': 14.2, '~': 18.0,
}
var averageCharacterWidth float32

func init() {
	n := 0
	for _, w := range CharacterWidth {
		averageCharacterWidth += w
		n++
	}
	averageCharacterWidth /= float32(n)
	averageCharacterWidth = 15
}

// Style contains all information about all graphic elements in a chart.
// All colors are in the form "#rrggbb" with rr/gg/bb hexvalues.
// Not all elements of a plot use all fields in this struct.
type Style struct {
	Symbol      int         // 0: no symbol; any codepoint: this symbol
	SymbolColor color.Color // color of symbol
	SymbolSize  float64     // ccaling factor of symbol
	LineStyle   LineStyle   // SolidLine, DashedLine, DottedLine, .... see below
	LineColor   color.Color // color of line
	LineWidth   int         // 0: no line,  >=1 width of line in pixel
	Font        Font        // the font to use
	FillColor   color.Color
}

// PlotStyle describes how data and functions are drawn in scatter plots.
// Can be used to describe how a key entry is drawn
type PlotStyle int

const (
	PlotStylePoints      PlotStyle = iota + 1 // draw symbol at data point
	PlotStyleLines                            // connect data points by straight lines
	PlotStyleLinesPoints                      // symbols and lines
	PlotStyleBox                              // produce boxplot
)

func (ps PlotStyle) undefined() bool {
	return int(ps) < 1 || int(ps) > 3
}

// LineStyle describes the different types of lines.
type LineStyle int

// The supported line styles
const (
	SolidLine      LineStyle = iota //  ----------------------
	DashedLine                      //  ----  ----  ----  ----
	DottedLine                      //  - - - - - - - - - - -
	DashDotDotLine                  //  ----  -  -  ----  -  -
	LongDashLine                    //
	LongDotLine
)

// Font describes a font
type Font struct {
	Name  string      // "": default
	Size  FontSize    // relative size of font to default in output graphics
	Color color.Color // "": default, other: use this
}

// FontSize is the reletive font size used in chart. Five sizes seem enough.
type FontSize int

const (
	TinyFontSize FontSize = iota - 2
	SmallFontSize
	NormalFontSize
	LargeFontSize
	HugeFontSize
)

func (d *Style) empty() bool {
	return d.Symbol == 0 && d.SymbolColor == nil && d.LineStyle == 0 &&
		d.LineColor == nil && d.FillColor == nil && d.SymbolSize == 0
}

// Standard colors used by AutoStyle
var StandardColors = []color.Color{
	color.NRGBA{0xcc, 0x00, 0x00, 0xff}, // red
	color.NRGBA{0x00, 0xbb, 0x00, 0xff}, // green
	color.NRGBA{0x00, 0x00, 0xdd, 0xff}, // blue
	color.NRGBA{0x99, 0x66, 0x00, 0xff}, // brown
	color.NRGBA{0xbb, 0x00, 0xbb, 0xff}, // violet
	color.NRGBA{0x00, 0xaa, 0xaa, 0xff}, // turquise
	color.NRGBA{0xbb, 0xbb, 0x00, 0xff}, // yellow
}

// Standard line styles used by AutoStyle (fill=false)
var StandardLineStyles = []LineStyle{SolidLine, DashedLine, DottedLine, LongDashLine, LongDotLine}

// Standard symbols used by AutoStyle
var StandardSymbols = []int{'o', '=', '%', '&', '+', 'X', '*', '@', '#', 'A', 'Z'}

// How much brighter/darker filled elements become.
var StandardFillFactor = 0.5

// AutoStyle produces a styles based on StandardColors, StandardLineStyles, and StandardSymbols.
// Call with fill = true for charts with filled elements (hist, bar, cbar, pie).
func AutoStyle(i int, fill bool) (style Style) {
	nc, nl, ns := len(StandardColors), len(StandardLineStyles), len(StandardSymbols)

	si := i % ns
	ci := i % nc
	li := i % nl

	style.Symbol = StandardSymbols[si]
	style.SymbolColor = StandardColors[ci]
	style.LineColor = StandardColors[ci]
	style.SymbolSize = 1

	if fill {
		style.LineStyle = SolidLine
		style.LineWidth = 3
		if i < nc {
			style.FillColor = lighter(style.LineColor, StandardFillFactor)
		} else if i <= 2*nc {
			style.FillColor = darker(style.LineColor, StandardFillFactor)
		} else {
			style.FillColor = style.LineColor
		}
	} else {
		style.LineStyle = StandardLineStyles[li]
		style.LineWidth = 1
	}
	return
}

// PlotElement identifies one element in a plot/chart
type PlotElement int

const (
	MajorAxisElement PlotElement = iota
	MinorAxisElement
	MajorTicElement
	MinorTicElement
	ZeroAxisElement
	GridLineElement
	GridBlockElement
	KeyElement
	TitleElement
	RangeLimitElement
)

// PlotOptions contains a Style for each PlotElement. If a PlotOption does not
// contain a certainPlotElement the value in DefaultStyle is used.
type PlotOptions map[PlotElement]Style

func elementStyle(options PlotOptions, element PlotElement) Style {
	if style, ok := options[element]; ok {
		return style
	}
	if style, ok := DefaultOptions[element]; ok {
		return style
	}
	return Style{LineColor: color.NRGBA{0x80, 0x80, 0x80, 0xff}, LineWidth: 1, LineStyle: SolidLine}
}
func ElementStyle(options PlotOptions, element PlotElement) Style {
	return elementStyle(options, element)
}

// DefaultStyle maps chart elements to styles.
var DefaultOptions = map[PlotElement]Style{
	MajorAxisElement: Style{LineColor: color.NRGBA{0, 0, 0, 0xff}, LineWidth: 2, LineStyle: SolidLine}, // axis
	MinorAxisElement: Style{LineColor: color.NRGBA{0, 0, 0, 0xff}, LineWidth: 2, LineStyle: SolidLine}, // mirrored axis
	MajorTicElement:  Style{LineColor: color.NRGBA{0, 0, 0, 0xff}, LineWidth: 1, LineStyle: SolidLine},
	MinorTicElement:  Style{LineColor: color.NRGBA{0, 0, 0, 0xff}, LineWidth: 1, LineStyle: SolidLine},
	ZeroAxisElement:  Style{LineColor: color.NRGBA{0x40, 0x40, 0x40, 0xff}, LineWidth: 1, LineStyle: SolidLine},
	GridLineElement:  Style{LineColor: color.NRGBA{0x80, 0x80, 0x80, 0xff}, LineWidth: 1, LineStyle: SolidLine},
	GridBlockElement: Style{LineColor: color.NRGBA{0xe6, 0xfc, 0xfc, 0xff}, LineWidth: 0, FillColor: color.NRGBA{0xe6, 0xfc, 0xfc, 0xff}},
	KeyElement: Style{LineColor: color.NRGBA{0x20, 0x20, 0x20, 0xff}, LineWidth: 1, LineStyle: SolidLine,
		FillColor: color.NRGBA{0xf0, 0xf0, 0xf0, 0xc0}, Font: Font{Size: SmallFontSize}},
	TitleElement: Style{LineColor: color.NRGBA{0, 0, 0, 0xff}, LineWidth: 1, LineStyle: SolidLine,
		FillColor: color.NRGBA{0xec, 0xc7, 0x50, 0xff}, Font: Font{Size: LargeFontSize}},
	RangeLimitElement: Style{Font: Font{Size: SmallFontSize}},
}

func hsv2rgb(h, s, v int) (r, g, b int) {
	H := int(math.Floor(float64(h) / 60))
	S, V := float64(s)/100, float64(v)/100
	f := float64(h)/60 - float64(H)
	p := V * (1 - S)
	q := V * (1 - S*f)
	t := V * (1 - S*(1-f))

	switch H {
	case 0, 6:
		r, g, b = int(255*V), int(255*t), int(255*p)
	case 1:
		r, g, b = int(255*q), int(255*V), int(255*p)
	case 2:
		r, g, b = int(255*p), int(255*V), int(255*t)
	case 3:
		r, g, b = int(255*p), int(255*q), int(255*V)
	case 4:
		r, g, b = int(255*t), int(255*p), int(255*V)
	case 5:
		r, g, b = int(255*V), int(255*p), int(255*q)
	default:
		panic(fmt.Sprintf("Ooops: Strange H value %d in hsv2rgb(%d,%d,%d).", H, h, s, v))
	}

	return
}

func f3max(a, b, c float64) float64 {
	switch true {
	case a > b && a >= c:
		return a
	case b > c && b >= a:
		return b
	case c > a && c >= b:
		return c
	}
	return a
}

func f3min(a, b, c float64) float64 {
	switch true {
	case a < b && a <= c:
		return a
	case b < c && b <= a:
		return b
	case c < a && c <= b:
		return c
	}
	return a
}

func rgb2hsv(r, g, b int) (h, s, v int) {
	R, G, B := float64(r)/255, float64(g)/255, float64(b)/255

	if R == G && G == B {
		h, s = 0, 0
		v = int(r * 255)
	} else {
		max, min := f3max(R, G, B), f3min(R, G, B)
		if max == R {
			h = int(60 * (G - B) / (max - min))
		} else if max == G {
			h = int(60 * (2 + (B-R)/(max-min)))
		} else {
			h = int(60 * (4 + (R-G)/(max-min)))
		}
		if max == 0 {
			s = 0
		} else {
			s = int(100 * (max - min) / max)
		}
		v = int(100 * max)
	}
	if h < 0 {
		h += 360
	}
	return
}

func lighter(col color.Color, f float64) color.NRGBA {
	r, g, b, a := col.RGBA()
	h, s, v := rgb2hsv(int(r/256), int(g/256), int(b/256))
	f = 1 - f
	s = int(float64(s) * f)
	v += int((100 - float64(v)) * f)
	if v > 100 {
		v = 100
	}
	rr, gg, bb := hsv2rgb(h, s, v)

	return color.NRGBA{uint8(rr), uint8(gg), uint8(bb), uint8(a / 256)}
}

func darker(col color.Color, f float64) color.NRGBA {
	r, g, b, a := col.RGBA()
	h, s, v := rgb2hsv(int(r), int(g), int(b))
	f = 1 - f
	v = int(float64(v) * f)
	s += int((100 - float64(s)) * f)
	if s > 100 {
		s = 100
	}
	rr, gg, bb := hsv2rgb(h, s, v)

	return color.NRGBA{uint8(rr), uint8(gg), uint8(bb), uint8(a / 256)}
}
