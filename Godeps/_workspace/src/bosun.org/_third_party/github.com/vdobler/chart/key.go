package chart

import (
	"strings"
)

// Key encapsulates settings for keys/legends in a chart.
//
// Key placement os governed by Pos which may take the following values:
//          otl  otc  otr
//         +-------------+
//     olt |itl  itc  itr| ort
//         |             |
//     olc |icl  icc  icr| orc
//         |             |
//     olb |ibl  ibc  ibr| orb
//         +-------------+
//          obl  obc  obr
//
type Key struct {
	Hide    bool       // Don't show key/legend if true
	Cols    int        // Number of colums to use. If <0 fill rows before colums
	Border  int        // -1: off, 0: std, 1...:other styles
	Pos     string     // default "" is "itr"
	Entries []KeyEntry // List of entries in the legend
	X, Y    int
}

// KeyEntry encapsulates an antry in the key/legend.
type KeyEntry struct {
	Text      string    // Text to display
	PlotStyle PlotStyle // What to show: symbol, line, bar, combi thereof
	Style     Style     // How to show

}

// Place layouts the Entries in key in the requested (by key.Cols) matrix format
func (key Key) Place() (matrix [][]*KeyEntry) {
	// count real entries in num, see if multilines are present in haveml
	num := 0
	for _, e := range key.Entries {
		if e.Text == "" {
			continue
		}
		num++
	}
	if num == 0 {
		return // no entries
	}

	rowfirst := false
	cols := key.Cols
	if cols < 0 {
		cols = -cols
		rowfirst = true
	}
	if cols == 0 {
		cols = 1
	}
	if num < cols {
		cols = num
	}
	rows := (num + cols - 1) / cols

	// Prevent empty last columns in the following case where 5 elements are placed
	// columnsfirst into 4 columns
	//  Col   0    1    2    3
	//       AAA  CCC  EEE
	//       BBB  DDD
	if !rowfirst && rows*(cols-1) >= num {
		cols--
	}

	// Arrays with infos
	matrix = make([][]*KeyEntry, cols)
	for i := 0; i < cols; i++ {
		matrix[i] = make([]*KeyEntry, rows)
	}

	i := 0
	for _, e := range key.Entries {
		if e.Text == "" {
			continue
		}
		var r, c int
		if rowfirst {
			r, c = i/cols, i%cols
		} else {
			c, r = i/rows, i%rows
		}
		matrix[c][r] = &KeyEntry{Text: e.Text, Style: e.Style, PlotStyle: e.PlotStyle}
		// fmt.Printf("Place1 (%d,%d) = %d: %s\n", c,r, i, matrix[c][r].Text)
		i++
	}
	return
}

func textviewlen(t string) (length float32) {
	n := 0
	for _, r := range t {
		if w, ok := CharacterWidth[int(r)]; ok {
			length += w
		} else {
			length += 23 // save above average
		}
		n++
	}
	length /= averageCharacterWidth
	// fmt.Printf("Length >%s<: %d runes = %.2f  (%d)\n", t, n, length, int(100*length/float32(n)))
	return
}

func textDim(t string) (w float32, h int) {
	lines := strings.Split(t, "\n")
	for _, t := range lines {
		tvl := textviewlen(t)
		if tvl > w {
			w = tvl
		}
	}
	h = len(lines)
	return
}

// The following variables control the layout of the key/legend box.
// All values are in font-units (fontheight for vertical, fontwidth for horizontal values)
var (
	KeyHorSep      float32 = 1.5  // Horizontal spacing between key box and content
	KeyVertSep     float32 = 0.5  // Vertical spacing between key box and content
	KeyColSep      float32 = 2.0  // Horizontal spacing between two columns in key
	KeySymbolWidth float32 = 5    // Horizontal length/space reserved for symbol
	KeySymbolSep   float32 = 2    // Horizontal spacing bewteen symbol and text
	KeyRowSep      float32 = 0.75 // Vertical spacing between individual rows.
)

func (key Key) Layout(bg BasicGraphics, m [][]*KeyEntry, font Font) (w, h int, colwidth, rowheight []int) {
	fontwidth, fontheight, _ := bg.FontMetrics(font)
	cols, rows := len(m), len(m[0])

	// Find total width and height
	totalh := 0
	rowheight = make([]int, rows)
	for r := 0; r < rows; r++ {
		rh := 0
		for c := 0; c < cols; c++ {
			e := m[c][r]
			if e == nil {
				continue
			}
			// fmt.Printf("Layout1 (%d,%d): %s\n", c,r,e.Text)
			_, h := textDim(e.Text)
			if h > rh {
				rh = h
			}
		}
		rowheight[r] = rh
		totalh += rh
	}

	totalw := 0
	colwidth = make([]int, cols)
	// fmt.Printf("Making totalw for %d cols\n", cols)
	for c := 0; c < cols; c++ {
		var rw float32
		for r := 0; r < rows; r++ {
			e := m[c][r]
			if e == nil {
				continue
			}
			// fmt.Printf("Layout2 (%d,%d): %s\n", c,r,e.Text)

			w, _ := textDim(e.Text)
			if w > rw {
				rw = w
			}
		}
		irw := int(rw + 0.75)
		colwidth[c] = irw
		totalw += irw
		// fmt.Printf("Width of col %d: %d.  Total now: %d\n", c, irw, totalw)
	}

	if fontwidth == 1 && fontheight == 1 {
		// totalw/h are characters only and still in character-units
		totalw += int(KeyColSep) * (cols - 1)                 // add space between columns
		totalw += int(2*KeyHorSep + 0.5)                      // add space for left/right border
		totalw += int(KeySymbolWidth+KeySymbolSep+0.5) * cols // place for symbol and symbol-text sep

		totalh += int(KeyRowSep) * (rows - 1) // add space between rows
		vsep := KeyVertSep
		if vsep < 1 {
			vsep = 1
		} // make sure there _is_ room (as KeyVertSep < 1)
		totalh += int(2 * vsep) // add border at top/bottom
	} else {
		// totalw/h are characters only and still in character-units
		totalw = int(float32(totalw) * fontwidth)                     // scale to pixels
		totalw += int(KeyColSep * (float32(cols-1) * fontwidth))      // add space between columns
		totalw += int(2 * KeyHorSep * fontwidth)                      // add space for left/right border
		totalw += int((KeySymbolWidth+KeySymbolSep)*fontwidth) * cols // place for symbol and symbol-text sep

		totalh *= fontheight
		totalh += int(KeyRowSep * float32((rows-1)*fontheight)) // add space between rows
		vsep := KeyVertSep * float32(fontheight)
		if vsep < 1 {
			vsep = 1
		} // make sure there _is_ room (as KeyVertSep < 1)
		totalh += int(2 * vsep) // add border at top/bottom
	}
	return totalw, totalh, colwidth, rowheight
}

func GenericKey(bg BasicGraphics, x, y int, key Key, options PlotOptions) {
	m := key.Place()
	if len(m) == 0 {
		return
	}
	keyfont := elementStyle(options, KeyElement).Font
	fw, fh, _ := bg.FontMetrics(keyfont)
	tw, th, cw, rh := key.Layout(bg, m, keyfont)
	style := elementStyle(options, KeyElement)
	if key.Border >= 0 {
		bg.Rect(x, y, tw, th, style)
	}
	x += int(KeyHorSep * fw)
	vsep := KeyVertSep * float32(fh)
	if vsep < 1 {
		vsep = 1
	} // make sure there _is_ room (as KeyVertSep < 1)
	// fmt.Printf("Key: y = %d  after  %d\n", y, y+int(vsep)+fh/2)
	y += int(vsep) + fh/2
	for ci, col := range m {
		yy := y

		for ri, e := range col {
			if e == nil || e.Text == "" {
				continue
			}
			plotStyle := e.PlotStyle
			// fmt.Printf("KeyEntry %s: PlotStyle = %d\n", e.Text, e.PlotStyle)
			if plotStyle == -1 {
				// heading only...
				bg.Text(x, yy, e.Text, "cl", 0, keyfont)
			} else {
				// normal entry
				if (plotStyle & PlotStyleLines) != 0 {
					bg.Line(x, yy, x+int(KeySymbolWidth*fw), yy, e.Style)
				}
				if (plotStyle & PlotStylePoints) != 0 {
					bg.Symbol(x+int(KeySymbolWidth*fw)/2, yy, e.Style)
				}
				if (plotStyle & PlotStyleBox) != 0 {
					sh := fh / 2
					a := x + int(KeySymbolWidth*fw)/2
					bg.Rect(a-sh, yy-sh, 2*sh, 2*sh, e.Style)
				}
				bg.Text(x+int(fw*(KeySymbolWidth+KeySymbolSep)), yy, e.Text, "cl", 0, keyfont)
			}
			yy += fh*rh[ri] + int(KeyRowSep*float32(fh))
		}

		x += int((KeySymbolWidth + KeySymbolSep + KeyColSep + float32(cw[ci])) * fw)
	}
}
