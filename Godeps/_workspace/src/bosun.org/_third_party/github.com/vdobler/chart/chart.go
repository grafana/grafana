package chart

import (
	"fmt"
	"io/ioutil"
	"log"
	"math"
	"time"
)

// Chart ist the very simple interface for all charts: They can be plotted to a graphics output.
type Chart interface {
	Plot(g Graphics) // Output chart to g
	Reset()          // Reset any setting made during last plot
}

// Expansion determines the way an axis range is expanded to align
// nicely with the tics on the axis.
type Expansion int

// Suitable values for Expand in RangeMode.
const (
	ExpandNextTic Expansion = iota // Set min/max to next tic really below/above min/max of data
	ExpandToTic                    // Set to next tic below/above or equal to min/max of data
	ExpandTight                    // Use data min/max as limit
	ExpandABit                     // Like ExpandToTic and add/subtract ExpandABitFraction of tic distance.
)

var ExpandABitFraction = 0.5 // Fraction of tic spacing added in ExpandABit Range.Expand mode.

// RangeMode describes how one end of an axis is set up. There are basically three different main modes:
//   o Fixed: Fixed==true.
//     Use Value/TValue as fixed value ignoring data.
//   o Unconstrained autoscaling: Fixed==false && Constrained==false.
//     Set range to whatever data requires.
//   o Constrained autoscaling: Fixed==false && Constrained==true.
//     Scale axis according to data present, but limit scaling to intervall [Lower,Upper]
// For both autoscaling modes Expand defines how much expansion is done below/above
// the lowest/highest data point.
type RangeMode struct {
	Fixed          bool      // If false: autoscaling. If true: use (T)Value/TValue as fixed setting
	Constrained    bool      // If false: full autoscaling. If true: use (T)Lower (T)Upper as limits
	Expand         Expansion // One of ExpandNextTic, ExpandTight, ExpandABit
	Value          float64   // Value of end point of axis in Fixed=true mode, ignorder otherwise
	TValue         time.Time // Same as Value, but used for Date/Time axis
	Lower, Upper   float64   // Lower and upper limit for constrained autoscaling
	TLower, TUpper time.Time // Same s Lower/Upper, but used for Date/Time axis
}

// GridMode describes the way a grid on the major tics is drawn
type GridMode int

const (
	GridOff    GridMode = iota // No grid lines
	GridLines                  // Grid lines
	GridBlocks                 // Zebra style background
)

// MirrorAxis describes if and how an axis is drawn on the oposite side of
// a chart,
type MirrorAxis int

const (
	MirrorAxisAndTics MirrorAxis = 0  // draw a full mirrored axis including tics
	MirrorNothing     MirrorAxis = -1 // do not draw a mirrored axis
	MirrorAxisOnly    MirrorAxis = 1  // just draw a mirrord axis, but omit tics
)

// TicSettings describes how (if at all) tics are shown on an axis.
type TicSetting struct {
	Hide       bool       // dont show tics if true
	HideLabels bool       // don't show tic labels if true
	Tics       int        // 0: across axis,  1: inside,  2: outside,  other: off
	Minor      int        // 0: off,  1: auto,  >1: number of intervalls (not number of tics!)
	Delta      float64    // wanted step between major tics.  0 means auto
	TDelta     TimeDelta  // same as Delta, but used for Date/Time axis
	Grid       GridMode   // GridOff, GridLines, GridBlocks
	Mirror     MirrorAxis // 0: mirror axis and tics, -1: don't mirror anything, 1: mirror axis only (no tics)

	Format  func(float64) string              // User function to format tics.
	TFormat func(time.Time, TimeDelta) string // User function to format tics for date/time axis

	UserDelta bool // true if Delta or TDelta was input
}

// Tic describs a single tic on an axis.
type Tic struct {
	Pos      float64 // position of the tic on the axis (in data coordinates).
	LabelPos float64 // position of the label on the axis (in data coordinates).
	Label    string  // the Label of the tic
	Align    int     // alignment of the label:  -1: left/top,  0 center,  1 right/bottom (unused)
}

// Range encapsulates all information about an axis.
type Range struct {
	Label            string     // Label of axis
	Log              bool       // Logarithmic axis?
	Time             bool       // Date/Time axis?
	MinMode, MaxMode RangeMode  // How to handel min and max of this axis/range
	TicSetting       TicSetting // How to handle tics.
	DataMin, DataMax float64    // Actual min/max values from data. If both zero: not calculated
	ShowLimits       bool       // Display axis Min and Max values on plot
	ShowZero         bool       // Add line to show 0 of this axis
	Category         []string   // If not empty (and neither Log nor Time): Use Category[n] as tic label at pos n+1.

	// The following values are set up during plotting
	Min, Max   float64   // Actual minium and maximum of this axis/range.
	TMin, TMax time.Time // Same as Min/Max, but used for Date/Time axis
	Tics       []Tic     // List of tics to display

	// The following functions are set up during plotting
	Norm        func(float64) float64 // Function to map [Min:Max] to [0:1]
	InvNorm     func(float64) float64 // Inverse of Norm()
	Data2Screen func(float64) int     // Function to map data value to screen position
	Screen2Data func(int) float64     // Inverse of Data2Screen
}

// Fixed is a helper (just reduces typing) functions which turns of autoscaling
// and sets the axis range to [min,max] and the tic distance to delta.
func (r *Range) Fixed(min, max, delta float64) {
	r.MinMode.Fixed, r.MaxMode.Fixed = true, true
	r.MinMode.Value, r.MaxMode.Value = min, max
	r.TicSetting.Delta = delta
}

func (r *Range) TFixed(min, max time.Time, delta TimeDelta) {
	r.MinMode.Fixed, r.MaxMode.Fixed = true, true
	r.MinMode.TValue, r.MaxMode.TValue = min, max
	r.TicSetting.TDelta = delta
}

// Reset resets the fields in r which have been set up during a plot.
func (r *Range) Reset() {
	r.Min, r.Max = 0, 0
	r.TMin, r.TMax = time.Time{}, time.Time{}
	r.Tics = nil
	r.Norm, r.InvNorm = nil, nil
	r.Data2Screen, r.Screen2Data = nil, nil

	if !r.TicSetting.UserDelta {
		r.TicSetting.Delta = 0
		r.TicSetting.TDelta = nil
	}
}

// Prepare the range r for use, especially set up all values needed for autoscale() to work properly
func (r *Range) init() { r.Init() }
func (r *Range) Init() {
	// All the min stuff
	if r.MinMode.Fixed {
		// copy TValue to Value if set and time axis
		if r.Time && !r.MinMode.TValue.IsZero() {
			r.MinMode.Value = float64(r.MinMode.TValue.Unix())
		}
		r.DataMin = r.MinMode.Value
	} else if r.MinMode.Constrained {
		// copy TLower/TUpper to Lower/Upper if set and time axis
		if r.Time && !r.MinMode.TLower.IsZero() {
			r.MinMode.Lower = float64(r.MinMode.TLower.Unix())
		}
		if r.Time && !r.MinMode.TUpper.IsZero() {
			r.MinMode.Upper = float64(r.MinMode.TUpper.Unix())
		}
		if r.MinMode.Lower == 0 && r.MinMode.Upper == 0 {
			// Constrained but un-initialized: Full autoscaling
			r.MinMode.Lower = -math.MaxFloat64
			r.MinMode.Upper = math.MaxFloat64
		}
		r.DataMin = r.MinMode.Upper
	} else {
		r.DataMin = math.MaxFloat64
	}

	// All the max stuff
	if r.MaxMode.Fixed {
		// copy TValue to Value if set and time axis
		if r.Time && !r.MaxMode.TValue.IsZero() {
			r.MaxMode.Value = float64(r.MaxMode.TValue.Unix())
		}
		r.DataMax = r.MaxMode.Value
	} else if r.MaxMode.Constrained {
		// copy TLower/TUpper to Lower/Upper if set and time axis
		if r.Time && !r.MaxMode.TLower.IsZero() {
			r.MaxMode.Lower = float64(r.MaxMode.TLower.Unix())
		}
		if r.Time && !r.MaxMode.TUpper.IsZero() {
			r.MaxMode.Upper = float64(r.MaxMode.TUpper.Unix())
		}
		if r.MaxMode.Lower == 0 && r.MaxMode.Upper == 0 {
			// Constrained but un-initialized: Full autoscaling
			r.MaxMode.Lower = -math.MaxFloat64
			r.MaxMode.Upper = math.MaxFloat64
		}
		r.DataMax = r.MaxMode.Upper
	} else {
		r.DataMax = -math.MaxFloat64
	}

	// fmt.Printf("At end of init: DataMin / DataMax  =   %g / %g\n", r.DataMin, r.DataMax)
}

// Update DataMin and DataMax according to the RangeModes.
func (r *Range) autoscale(x float64) {

	if x < r.DataMin && !r.MinMode.Fixed {
		if !r.MinMode.Constrained {
			// full autoscaling
			r.DataMin = x
		} else {
			r.DataMin = fmin(fmax(x, r.MinMode.Lower), r.DataMin)
		}
	}

	if x > r.DataMax && !r.MaxMode.Fixed {
		if !r.MaxMode.Constrained {
			// full autoscaling
			r.DataMax = x
		} else {
			r.DataMax = fmax(fmin(x, r.MaxMode.Upper), r.DataMax)
		}
	}
}

// Units are the SI prefixes for 10^3n
var Units = []string{" y", " z", " a", " f", " p", " n", " µ", "m", " k", " M", " G", " T", " P", " E", " Z", " Y"}

// FmtFloat yields a string representation of f. E.g. 12345.67 --> "12.3 k";  0.09876 --> "99 m"
func FmtFloat(f float64) string {
	af := math.Abs(f)
	if f == 0 {
		return "0"
	} else if 1 <= af && af < 10 {
		return fmt.Sprintf("%.1f", f)
	} else if 10 <= af && af <= 1000 {
		return fmt.Sprintf("%.0f", f)
	}

	if af < 1 {
		var p = 8
		for math.Abs(f) < 1 && p >= 0 {
			f *= 1000
			p--
		}
		return FmtFloat(f) + Units[p]
	} else {
		var p = 7
		for math.Abs(f) > 1000 && p < 16 {
			f /= 1000
			p++
		}
		return FmtFloat(f) + Units[p]

	}
	return "xxx"
}

func almostEqual(a, b, d float64) bool {
	return math.Abs(a-b) < d
}

// applyRangeMode returns val constrained by mode. val is considered the upper end of an range/axis
// if upper is true. To allow proper rounding to tic (depending on desired RangeMode)
// the ticDelta has to be provided. Logaritmic axis are selected by log = true and ticDelta
// is ignored: Tics are of the form 1*10^n.
func applyRangeMode(mode RangeMode, val, ticDelta float64, upper, log bool) float64 {
	if mode.Fixed {
		return mode.Value
	}
	if mode.Constrained {
		if val < mode.Lower {
			val = mode.Lower
		} else if val > mode.Upper {
			val = mode.Upper
		}
	}

	switch mode.Expand {
	case ExpandToTic, ExpandNextTic:
		var v float64
		if upper {
			if log {
				v = math.Pow10(int(math.Ceil(math.Log10(val))))
			} else {
				v = math.Ceil(val/ticDelta) * ticDelta
			}
		} else {
			if log {
				v = math.Pow10(int(math.Floor(math.Log10(val))))
			} else {
				v = math.Floor(val/ticDelta) * ticDelta
			}
		}
		if mode.Expand == ExpandNextTic {
			if upper {
				if log {
					if val/v < 2 { // TODO(vodo) use ExpandABitFraction
						v *= ticDelta
					}
				} else {
					if almostEqual(v, val, ticDelta/15) {
						v += ticDelta
					}
				}
			} else {
				if log {
					if v/val > 7 { // TODO(vodo) use ExpandABitFraction
						v /= ticDelta
					}
				} else {
					if almostEqual(v, val, ticDelta/15) {
						v -= ticDelta
					}
				}
			}
		}
		val = v
	case ExpandABit:
		if upper {
			if log {
				val *= math.Pow(10, ExpandABitFraction)
			} else {
				val += ticDelta * ExpandABitFraction
			}
		} else {
			if log {
				val /= math.Pow(10, ExpandABitFraction)
			} else {
				val -= ticDelta * ExpandABitFraction
			}
		}
	}

	return val
}

// tApplyRangeMode is the same as applyRangeMode for date/time axis/ranges.
func tApplyRangeMode(mode RangeMode, val time.Time, step TimeDelta, upper bool) (bound time.Time, tic time.Time) {
	if mode.Fixed {
		bound = mode.TValue
		if upper {
			tic = RoundDown(val, step)
		} else {
			tic = RoundUp(val, step)
		}
		return
	}
	if mode.Constrained { // TODO(vodo) use T...
		sval := val.Unix()
		if sval < int64(mode.Lower) {
			sval = int64(mode.Lower)
		} else if sval > int64(mode.Upper) {
			sval = int64(mode.Upper)
		}
		val = time.Unix(sval, 0)
	}

	switch mode.Expand {
	case ExpandToTic:
		if upper {
			val = RoundUp(val, step)
		} else {
			val = RoundDown(val, step)
		}
		return val, val
	case ExpandNextTic:
		if upper {
			tic = RoundUp(val, step)
		} else {
			tic = RoundDown(val, step)
		}
		s := tic.Unix()
		if math.Abs(float64(s-val.Unix())/float64(step.Seconds())) < 0.15 {
			if upper {
				val = RoundUp(time.Unix(s+step.Seconds()/2, 0), step)
			} else {
				val = RoundDown(time.Unix(s-step.Seconds()/2, 0), step)
			}
		} else {
			val = tic
		}
		return val, val
	case ExpandABit:
		if upper {
			tic = RoundDown(val, step)
			val = time.Unix(tic.Unix()+step.Seconds()/2, 0)
		} else {
			tic = RoundUp(val, step)
			val = time.Unix(tic.Unix()-step.Seconds()/2, 0)
		}
		return

	}

	return val, val
}

func f2d(x float64) string {
	s := int64(x)
	t := time.Unix(s, 0)
	return t.Format("2006-01-02 15:04:05 (Mon)")
}

func (r *Range) tSetup(desiredNumberOfTics, maxNumberOfTics int, delta, mindelta float64) {
	DebugLogger.Printf("Data: [ %s : %s ] --> delta/mindelta = %.3g/%.3g (desired %d/max %d)\n",
		f2d(r.DataMin), f2d(r.DataMax), delta, mindelta, desiredNumberOfTics, maxNumberOfTics)

	var td TimeDelta
	if r.TicSetting.TDelta != nil {
		td = r.TicSetting.TDelta
		r.TicSetting.UserDelta = true
	} else {
		td = MatchingTimeDelta(delta, 3)
		r.TicSetting.UserDelta = false
	}
	r.ShowLimits = true

	// Set up time tic delta
	mint := time.Unix(int64(r.DataMin), 0)
	maxt := time.Unix(int64(r.DataMax), 0)

	var ftic, ltic time.Time
	r.TMin, ftic = tApplyRangeMode(r.MinMode, mint, td, false)
	r.TMax, ltic = tApplyRangeMode(r.MaxMode, maxt, td, true)
	r.TicSetting.Delta, r.TicSetting.TDelta = float64(td.Seconds()), td
	r.Min, r.Max = float64(r.TMin.Unix()), float64(r.TMax.Unix())

	ftd := float64(td.Seconds())
	actNumTics := int((r.Max - r.Min) / ftd)
	if actNumTics > maxNumberOfTics {
		// recalculate time tic delta
		DebugLogger.Printf("Switching from %s no next larger step %s", td, NextTimeDelta(td))
		td = NextTimeDelta(td)
		ftd = float64(td.Seconds())
		r.TMin, ftic = tApplyRangeMode(r.MinMode, mint, td, false)
		r.TMax, ltic = tApplyRangeMode(r.MaxMode, maxt, td, true)
		r.TicSetting.Delta, r.TicSetting.TDelta = float64(td.Seconds()), td
		r.Min, r.Max = float64(r.TMin.Unix()), float64(r.TMax.Unix())
		actNumTics = int((r.Max - r.Min) / ftd)
	}

	DebugLogger.Printf("DataRange:  %s  TO  %s", f2d(r.DataMin), f2d(r.DataMax))
	DebugLogger.Printf("AxisRange:  %s  TO  %s", f2d(r.Min), f2d(r.Max))
	DebugLogger.Printf("TicsRange:  %s  TO  %s  Step  %s",
		ftic.Format("2006-01-02 15:04:05 (Mon)"), ltic.Format("2006-01-02 15:04:05 (Mon)"), td)

	// Set up tics
	r.Tics = make([]Tic, 0)
	step := int64(td.Seconds())
	align := 0

	var formater func(t time.Time, td TimeDelta) string
	if r.TicSetting.TFormat != nil {
		formater = r.TicSetting.TFormat
	} else {
		formater = func(t time.Time, td TimeDelta) string { return td.Format(t) }
	}

	for i := 0; ftic.Unix() < ltic.Unix(); i++ {
		x := float64(ftic.Unix())
		label := formater(ftic, td)
		var labelPos float64
		if td.Period() {
			labelPos = x + float64(step)/2
		} else {
			labelPos = x
		}
		t := Tic{Pos: x, LabelPos: labelPos, Label: label, Align: align}
		r.Tics = append(r.Tics, t)
		ftic = RoundDown(time.Unix(ftic.Unix()+step+step/5, 0), td)
	}
	// last tic might not get label if period
	if td.Period() {
		r.Tics = append(r.Tics, Tic{Pos: float64(ftic.Unix())})
	} else {
		x := float64(ftic.Unix())
		label := formater(ftic, td)
		var labelPos float64
		labelPos = x
		t := Tic{Pos: x, LabelPos: labelPos, Label: label, Align: align}
		r.Tics = append(r.Tics, t)
	}
}

// Determine appropriate tic delta for normal (non dat/time) axis from desired delta and minimal delta.
func (r *Range) fDelta(delta, mindelta float64) float64 {
	if r.Log {
		return 10
	}

	// Set up nice tic delta of the form 1,2,5 * 10^n
	// TODO: deltas of 25 and 250 would be suitable too...
	de := math.Pow10(int(math.Floor(math.Log10(delta))))
	f := delta / de
	switch {
	case f < 2:
		f = 1
	case f < 4:
		f = 2
	case f < 9:
		f = 5
	default:
		f = 1
		de *= 10
	}
	delta = f * de
	if delta < mindelta {
		DebugLogger.Printf("Redoing delta: %g < %g", delta, mindelta)
		// recalculate tic delta
		switch f {
		case 1, 5:
			delta *= 2
		case 2:
			delta *= 2.5
		default:
			fmt.Printf("Oooops. Strange f: %g\n", f)
		}
	}
	return delta
}

// Set up normal (=non date/time axis)
func (r *Range) fSetup(desiredNumberOfTics, maxNumberOfTics int, delta, mindelta float64) {
	DebugLogger.Printf("Data: [ %.5g : %.5g ] --> delta/mindelta = %.3g/%.3g (desired %d/max %d)\n",
		r.DataMin, r.DataMax, delta, mindelta, desiredNumberOfTics, maxNumberOfTics)
	if r.TicSetting.Delta != 0 {
		delta = r.TicSetting.Delta
		r.TicSetting.UserDelta = true
	} else {
		delta = r.fDelta(delta, mindelta)
		r.TicSetting.UserDelta = false
	}

	r.Min = applyRangeMode(r.MinMode, r.DataMin, delta, false, r.Log)
	r.Max = applyRangeMode(r.MaxMode, r.DataMax, delta, true, r.Log)
	r.TicSetting.Delta = delta

	DebugLogger.Printf("DataRange:  %.6g  TO  %.6g", r.DataMin, r.DataMax)
	DebugLogger.Printf("AxisRange:  %.6g  TO  %.6g", r.Min, r.Max)

	formater := FmtFloat
	if r.TicSetting.Format != nil {
		formater = r.TicSetting.Format
	}

	if r.Log {
		x := math.Pow10(int(math.Ceil(math.Log10(r.Min))))
		last := math.Pow10(int(math.Floor(math.Log10(r.Max))))
		DebugLogger.Printf("TicsRange:  %.6g  TO  %.6g  Factor  %.6g", x, last, delta)
		r.Tics = make([]Tic, 0, maxNumberOfTics)
		for ; x <= last; x = x * delta {
			t := Tic{Pos: x, LabelPos: x, Label: formater(x)}
			r.Tics = append(r.Tics, t)
			// fmt.Printf("%v\n", t)
		}

	} else {
		if len(r.Category) > 0 {
			DebugLogger.Printf("TicsRange:  %d categorical tics.", len(r.Category))
			r.Tics = make([]Tic, len(r.Category))
			for i, c := range r.Category {
				x := float64(i)
				if x < r.Min {
					continue
				}
				if x > r.Max {
					break
				}
				r.Tics[i].Pos = math.NaN() // no tic
				r.Tics[i].LabelPos = x
				r.Tics[i].Label = c
			}

		} else {
			// normal numeric axis
			first := delta * math.Ceil(r.Min/delta)
			num := int(-first/delta + math.Floor(r.Max/delta) + 1.5)
			DebugLogger.Printf("TicsRange:  %.6g  TO  %.6g  Step  %.6g", first, first+float64(num)*delta, delta)

			// Set up tics
			r.Tics = make([]Tic, num)
			for i, x := 0, first; i < num; i, x = i+1, x+delta {
				r.Tics[i].Pos, r.Tics[i].LabelPos = x, x
				r.Tics[i].Label = formater(x)
			}
		}
		// TODO(vodo) r.ShowLimits = true
	}
}

// SetUp sets up several fields of Range r according to RangeModes and TicSettings.
// DataMin and DataMax of r must be present and should indicate lowest and highest
// value present in the data set. The following fields of r are filled:
//   (T)Min and (T)Max    lower and upper limit of axis, (T)-version for date/time axis
//   Tics                 slice of tics to draw
//   TicSetting.(T)Delta  actual tic delta
//   Norm and InvNorm     mapping of [lower,upper]_data --> [0:1] and inverse
//   Data2Screen          mapping of data to screen coordinates
//   Screen2Data          inverse of Data2Screen
// The parameters desiredNumberOfTics and maxNumberOfTics are what the say.
// sWidth and sOffset are screen-width and -offset and are used to set up the
// Data-Screen conversion functions. If revert is true, than screen coordinates
// are asumed to be the other way around than mathematical coordinates.
//
// TODO(vodo) seperate screen stuff into own method.
func (r *Range) Setup(desiredNumberOfTics, maxNumberOfTics, sWidth, sOffset int, revert bool) {
	// Sanitize input
	if desiredNumberOfTics <= 1 {
		desiredNumberOfTics = 2
	}
	if maxNumberOfTics < desiredNumberOfTics {
		maxNumberOfTics = desiredNumberOfTics
	}
	if r.DataMax == r.DataMin {
		r.DataMax = r.DataMin + 1
	}
	delta := (r.DataMax - r.DataMin) / float64(desiredNumberOfTics-1)
	mindelta := (r.DataMax - r.DataMin) / float64(maxNumberOfTics-1)

	if r.Time {
		r.tSetup(desiredNumberOfTics, maxNumberOfTics, delta, mindelta)
	} else { // simple, not a date range
		r.fSetup(desiredNumberOfTics, maxNumberOfTics, delta, mindelta)
	}

	if r.Log {
		r.Norm = func(x float64) float64 { return math.Log10(x/r.Min) / math.Log10(r.Max/r.Min) }
		r.InvNorm = func(f float64) float64 { return (r.Max-r.Min)*f + r.Min }
	} else {
		r.Norm = func(x float64) float64 { return (x - r.Min) / (r.Max - r.Min) }
		r.InvNorm = func(f float64) float64 { return (r.Max-r.Min)*f + r.Min }
	}

	if !revert {
		r.Data2Screen = func(x float64) int {
			return int(float64(sWidth)*r.Norm(x)) + sOffset
		}
		r.Screen2Data = func(x int) float64 {
			return r.InvNorm(float64(x-sOffset) / float64(sWidth))
		}
	} else {
		r.Data2Screen = func(x float64) int {
			return sWidth - int(float64(sWidth)*r.Norm(x)) + sOffset
		}
		r.Screen2Data = func(x int) float64 {
			return r.InvNorm(float64(-x+sOffset+sWidth) / float64(sWidth))
		}

	}

}

// LayoutData encapsulates the layout of the graph area in the whole drawing area.
type LayoutData struct {
	Width, Height      int // width and height of graph area
	Left, Top          int // left and top margin
	KeyX, KeyY         int // x and y coordiante of key
	NumXtics, NumYtics int // suggested numer of tics for both axis
}

// Layout graph data area on screen and place key.
func layout(g Graphics, title, xlabel, ylabel string, hidextics, hideytics bool, key *Key) (ld LayoutData) {
	fw, fh, _ := g.FontMetrics(Font{})
	w, h := g.Dimensions()

	if key.Pos == "" {
		key.Pos = "itr"
	}

	width, leftm, height, topm := w-int(6*fw), int(2*fw), h-2*fh, fh
	xlabsep, ylabsep := fh, int(3*fw)
	if title != "" {
		topm += (5 * fh) / 2
		height -= (5 * fh) / 2
	}
	if xlabel != "" {
		height -= (3 * fh) / 2
	}
	if !hidextics {
		height -= (3 * fh) / 2
		xlabsep += (3 * fh) / 2
	}
	if ylabel != "" {
		leftm += 2 * fh
		width -= 2 * fh
	}
	if !hideytics {
		leftm += int(6 * fw)
		width -= int(6 * fw)
		ylabsep += int(6 * fw)
	}

	if key != nil && !key.Hide && len(key.Place()) > 0 {
		m := key.Place()
		kw, kh, _, _ := key.Layout(g, m, Font{}) // TODO: use real font
		sepx, sepy := int(fw)+fh, int(fw)+fh
		switch key.Pos[:2] {
		case "ol":
			width, leftm = width-kw-sepx, leftm+kw
			ld.KeyX = sepx / 2
		case "or":
			width = width - kw - sepx
			ld.KeyX = w - kw - sepx/2
		case "ot":
			height, topm = height-kh-sepy, topm+kh
			ld.KeyY = sepy / 2
			if title != "" {
				ld.KeyY += 2 * fh
			}
		case "ob":
			height = height - kh - sepy
			ld.KeyY = h - kh - sepy/2
		case "it":
			ld.KeyY = topm + sepy
		case "ic":
			ld.KeyY = topm + (height-kh)/2
		case "ib":
			ld.KeyY = topm + height - kh - sepy

		}

		switch key.Pos[:2] {
		case "ol", "or":
			switch key.Pos[2] {
			case 't':
				ld.KeyY = topm
			case 'c':
				ld.KeyY = topm + (height-kh)/2
			case 'b':
				ld.KeyY = topm + height - kh
			}
		case "ot", "ob":
			switch key.Pos[2] {
			case 'l':
				ld.KeyX = leftm
			case 'c':
				ld.KeyX = leftm + (width-kw)/2
			case 'r':
				ld.KeyX = w - kw - sepx
			}
		}
		if key.Pos[0] == 'i' {
			switch key.Pos[2] {
			case 'l':
				ld.KeyX = leftm + sepx
			case 'c':
				ld.KeyX = leftm + (width-kw)/2
			case 'r':
				ld.KeyX = leftm + width - kw - sepx
			}
		}
	}

	// fmt.Printf("width=%d, height=%d, leftm=%d, topm=%d  (fw=%d)\n", width, height, leftm, topm, int(fw))

	// Number of tics
	if width/int(fw) <= 20 {
		ld.NumXtics = 2
	} else {
		ld.NumXtics = width / int(10*fw)
		if ld.NumXtics > 25 {
			ld.NumXtics = 25
		}
	}
	ld.NumYtics = height / (4 * fh)
	if ld.NumYtics > 20 {
		ld.NumYtics = 20
	}

	ld.Width, ld.Height = width, height
	ld.Left, ld.Top = leftm, topm

	return
}

// DebugLogger is used to log some information about the chart generation.
var DebugLogger *log.Logger = log.New(ioutil.Discard, "", 0)
