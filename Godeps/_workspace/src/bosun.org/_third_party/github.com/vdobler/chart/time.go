package chart

import (
	"fmt"
	"time"
)

// Represents a tic-distance in a timed axis
type TimeDelta interface {
	Seconds() int64                  // amount of delta in seconds
	RoundDown(t time.Time) time.Time // Round dow t to "whole" delta
	String() string                  // retrieve string representation
	Format(t time.Time) string       // format t properly
	Period() bool                    // true if this delta is a time period (like a month)
}

// Copy value of src to dest.
func cpTime(dest, src time.Time) {
	// TODO remove
}

// Second
type Second struct {
	Num int
}

func (s Second) Seconds() int64 { return int64(s.Num) }
func (s Second) RoundDown(t time.Time) time.Time {
	return t.Add(time.Duration((s.Num*(t.Second()/s.Num))-t.Second()) * time.Second)
}
func (s Second) String() string            { return fmt.Sprintf("%d seconds(s)", s.Num) }
func (s Second) Format(t time.Time) string { return fmt.Sprintf("%02d'%02d\"", t.Minute(), t.Second()) }
func (s Second) Period() bool              { return false }

// Minute
type Minute struct {
	Num int
}

func (m Minute) Seconds() int64 { return int64(60 * m.Num) }
func (m Minute) RoundDown(t time.Time) time.Time {
	return t.Add(time.Duration(m.Num*(t.Minute()/m.Num)-t.Minute())*time.Minute - time.Duration(t.Second())*time.Second)
}
func (m Minute) String() string            { return fmt.Sprintf("%d minute(s)", m.Num) }
func (m Minute) Format(t time.Time) string { return fmt.Sprintf("%02d'", t.Minute()) }
func (m Minute) Period() bool              { return false }

// Hour
type Hour struct{ Num int }

func (h Hour) Seconds() int64 { return 60 * 60 * int64(h.Num) }
func (h Hour) RoundDown(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), h.Num*(t.Hour()/h.Num), 0, 0, 0, t.Location())
}
func (h Hour) String() string            { return fmt.Sprintf("%d hours(s)", h.Num) }
func (h Hour) Format(t time.Time) string { return fmt.Sprintf("%02d:%02d", t.Hour(), t.Minute()) }
func (h Hour) Period() bool              { return false }

// Day
type Day struct{ Num int }

func (d Day) Seconds() int64 { return 60 * 60 * 24 * int64(d.Num) }
func (d Day) RoundDown(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), d.Num*((t.Day()-1)/d.Num)+1, 0, 0, 0, 0, t.Location())
}
func (d Day) String() string            { return fmt.Sprintf("%d day(s)", d.Num) }
func (d Day) Format(t time.Time) string { return fmt.Sprintf("%s", t.Format("Mon")) }
func (d Day) Period() bool              { return true }

// Week
type Week struct {
	Num int
}

func (w Week) Seconds() int64 { return 60 * 60 * 24 * 7 * int64(w.Num) }
func (w Week) RoundDown(t time.Time) time.Time {
	org := t.Format("Mon 2006-01-02")
	_, week := t.ISOWeek()
	shift := int64(60 * 60 * 24 * (t.Weekday() - time.Monday))
	t = t.Add(-time.Duration(shift) * time.Second)
	t = time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, t.Location())
	// daylight saving and that like might lead to different real shift

	_, week2 := t.ISOWeek()
	for week2 < week {
		DebugLogger.Printf("B  %s", t)
		t = t.Add(time.Second * 60 * 60 * 36)
		t = time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, t.Location())
		_, week2 = t.ISOWeek()
	}
	for week2 > week {
		DebugLogger.Printf("C  %s", t)
		t = t.Add(-time.Second * 60 * 60 * 36)
		t = time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, t.Location())
		_, week2 = t.ISOWeek()
	}
	DebugLogger.Printf("Week.Roundown(%s) --> %s", org, t.Format("Mon 2006-01-02"))
	return t
}
func (w Week) String() string { return fmt.Sprintf("%d week(s)", w.Num) }
func (w Week) Format(t time.Time) string {
	_, week := t.ISOWeek()
	return fmt.Sprintf("W %d", week)
}
func (w Week) Period() bool { return true }

// Month
type Month struct {
	Num int
}

func (m Month) Seconds() int64 { return 60 * 60 * 24 * 365.25 / 12 * int64(m.Num) }
func (m Month) RoundDown(t time.Time) time.Time {
	return time.Date(t.Year(), time.Month(m.Num*(int(t.Month())-1)/m.Num+1),
		1, 0, 0, 0, 0, t.Location())
}
func (m Month) String() string { return fmt.Sprintf("%d month(s)", m.Num) }
func (m Month) Format(t time.Time) string {
	if m.Num == 3 { // quarter years
		return fmt.Sprintf("Q%d %d", (int(t.Month())-1)/3+1, t.Year())
	}
	if m.Num == 6 { // half years
		return fmt.Sprintf("H%d %d", (int(t.Month())-1)/6+1, t.Year())
	}
	return fmt.Sprintf("%02d.%d", int(t.Month()), t.Year())
}
func (m Month) Period() bool { return true }

// Year
type Year struct {
	Num int
}

func (y Year) Seconds() int64 { return 60 * 60 * 24 * 365.25 * int64(y.Num) }
func (y Year) RoundDown(t time.Time) time.Time {
	orig := t.Year()
	rd := y.Num * (orig / y.Num)
	t = time.Date(rd, 1, 1, 0, 0, 0, 0, t.Location())
	// TODO handle shifts in DLS and that
	DebugLogger.Printf("Year.RoundDown from %d to %d", orig, rd)
	return t
}
func (y Year) String() string { return fmt.Sprintf("%d year(s)", y.Num) }
func (y Year) Format(t time.Time) string {
	if y.Num == 10 {
		y := t.Year() / 10
		d := y % 10
		return fmt.Sprintf("%d0-%d9", y, d)
	} else if y.Num == 100 {
		y := t.Year() / 100
		return fmt.Sprintf("%d cen.", y)
	}
	return fmt.Sprintf("%d", t.Year())
}
func (y Year) Period() bool { return true }

// Delta is a list of increasing time deltas used to construct tic spacings
// for date/time axis.
// Must be sorted min to max according to Seconds() of each member.
var Delta []TimeDelta = []TimeDelta{
	Second{1}, Second{5}, Second{15},
	Minute{1}, Minute{5}, Minute{15},
	Hour{1}, Hour{6},
	Day{1}, Week{1},
	Month{1}, Month{3}, Month{6},
	Year{1}, Year{10}, Year{100},
}

// RoundUp will round tp up to next "full" d.
func RoundUp(t time.Time, d TimeDelta) time.Time {
	// works only because all TimeDeltas are more than 1.5 times as large as the next lower
	shift := d.Seconds()
	shift += shift / 2
	t = d.RoundDown(t)
	t = t.Add(time.Duration(shift) * time.Second)
	t = d.RoundDown(t)
	DebugLogger.Printf("RoundUp( %s, %s ) --> %s ", t.Format("2006-01-02 15:04:05 (Mon)"), d.String(),
		t.Format("2006-01-02 15:04:05 (Mon)"))
	return t
}

// RoundNext will round t to nearest full d.
func RoundNext(t time.Time, d TimeDelta) time.Time {
	DebugLogger.Printf("RoundNext( %s, %s )", t.Format("2006-01-02 15:04:05 (Mon)"), d.String())
	os := t.Unix()
	lt := d.RoundDown(t)
	shift := d.Seconds()
	shift += shift / 2
	ut := lt.Add(time.Duration(shift) * time.Second) // see RoundUp()
	ut = d.RoundDown(ut)
	ld := os - lt.Unix()
	ud := ut.Unix() - os
	if ld < ud {
		return lt
	}
	return ut
}

// RoundDown will round tp down to next "full" d.
func RoundDown(t time.Time, d TimeDelta) time.Time {
	td := d.RoundDown(t)
	DebugLogger.Printf("RoundDown( %s, %s ) --> %s", t.Format("2006-01-02 15:04:05 (Mon)"), d.String(),
		td.Format("2006-01-02 15:04:05 (Mon)"))
	return td
}

func NextTimeDelta(d TimeDelta) TimeDelta {
	var i = 0
	sec := d.Seconds()
	for i < len(Delta) && Delta[i].Seconds() <= sec {
		i++
	}
	if i < len(Delta) {
		return Delta[i]
	}
	return Delta[len(Delta)-1]
}

func MatchingTimeDelta(delta float64, fac float64) TimeDelta {
	var i = 0
	for i+1 < len(Delta) && delta > fac*float64(Delta[i+1].Seconds()) {
		i++
	}
	DebugLogger.Printf("MatchingTimeDelta(%g): i=%d, %s...%s  ==  %d...%d\n  %t\n",
		delta, i, Delta[i], Delta[i+1], Delta[i].Seconds(), Delta[i+1].Seconds(),
		i+1 < len(Delta) && delta > fac*float64(Delta[i+1].Seconds()))
	if i+1 < len(Delta) {
		return Delta[i+1]
	}
	return Delta[len(Delta)-1]
}

func dayOfWeek(y, m, d int) int {
	t := time.Date(y, time.Month(m), d, 0, 0, 0, 0, nil)
	return int(t.Weekday())
}

func FmtTime(sec int64, step TimeDelta) string {
	t := time.Unix(sec, 0)
	return step.Format(t)
}
