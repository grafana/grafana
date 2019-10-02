package es

import (
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/tsdb"
)

const (
	noInterval      = ""
	intervalHourly  = "hourly"
	intervalDaily   = "daily"
	intervalWeekly  = "weekly"
	intervalMonthly = "monthly"
	intervalYearly  = "yearly"
)

type indexPattern interface {
	GetIndices(timeRange *tsdb.TimeRange) ([]string, error)
}

var newIndexPattern = func(interval string, pattern string) (indexPattern, error) {
	if interval == noInterval {
		return &staticIndexPattern{indexName: pattern}, nil
	}

	return newDynamicIndexPattern(interval, pattern)
}

type staticIndexPattern struct {
	indexName string
}

func (ip *staticIndexPattern) GetIndices(timeRange *tsdb.TimeRange) ([]string, error) {
	return []string{ip.indexName}, nil
}

type intervalGenerator interface {
	Generate(from, to time.Time) []time.Time
}

type dynamicIndexPattern struct {
	interval          string
	pattern           string
	intervalGenerator intervalGenerator
}

func newDynamicIndexPattern(interval, pattern string) (*dynamicIndexPattern, error) {
	var generator intervalGenerator

	switch strings.ToLower(interval) {
	case intervalHourly:
		generator = &hourlyInterval{}
	case intervalDaily:
		generator = &dailyInterval{}
	case intervalWeekly:
		generator = &weeklyInterval{}
	case intervalMonthly:
		generator = &monthlyInterval{}
	case intervalYearly:
		generator = &yearlyInterval{}
	default:
		return nil, fmt.Errorf("unsupported interval '%s'", interval)
	}

	return &dynamicIndexPattern{
		interval:          interval,
		pattern:           pattern,
		intervalGenerator: generator,
	}, nil
}

func (ip *dynamicIndexPattern) GetIndices(timeRange *tsdb.TimeRange) ([]string, error) {
	from := timeRange.GetFromAsTimeUTC()
	to := timeRange.GetToAsTimeUTC()
	intervals := ip.intervalGenerator.Generate(from, to)
	indices := make([]string, 0)

	for _, t := range intervals {
		indices = append(indices, formatDate(t, ip.pattern))
	}

	return indices, nil
}

type hourlyInterval struct{}

func (i *hourlyInterval) Generate(from, to time.Time) []time.Time {
	intervals := []time.Time{}
	start := time.Date(from.Year(), from.Month(), from.Day(), from.Hour(), 0, 0, 0, time.UTC)
	end := time.Date(to.Year(), to.Month(), to.Day(), to.Hour(), 0, 0, 0, time.UTC)

	intervals = append(intervals, start)

	for start.Before(end) {
		start = start.Add(time.Hour)
		intervals = append(intervals, start)
	}

	return intervals
}

type dailyInterval struct{}

func (i *dailyInterval) Generate(from, to time.Time) []time.Time {
	intervals := []time.Time{}
	start := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, time.UTC)

	intervals = append(intervals, start)

	for start.Before(end) {
		start = start.Add(24 * time.Hour)
		intervals = append(intervals, start)
	}

	return intervals
}

type weeklyInterval struct{}

func (i *weeklyInterval) Generate(from, to time.Time) []time.Time {
	intervals := []time.Time{}
	start := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC)
	end := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, time.UTC)

	for start.Weekday() != time.Monday {
		start = start.Add(-24 * time.Hour)
	}

	for end.Weekday() != time.Monday {
		end = end.Add(-24 * time.Hour)
	}

	year, week := start.ISOWeek()
	intervals = append(intervals, start)

	for start.Before(end) {
		start = start.Add(24 * time.Hour)
		nextYear, nextWeek := start.ISOWeek()
		if nextYear != year || nextWeek != week {
			intervals = append(intervals, start)
		}
		year = nextYear
		week = nextWeek
	}

	return intervals
}

type monthlyInterval struct{}

func (i *monthlyInterval) Generate(from, to time.Time) []time.Time {
	intervals := []time.Time{}
	start := time.Date(from.Year(), from.Month(), 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(to.Year(), to.Month(), 1, 0, 0, 0, 0, time.UTC)

	month := start.Month()
	intervals = append(intervals, start)

	for start.Before(end) {
		start = start.Add(24 * time.Hour)
		nextMonth := start.Month()
		if nextMonth != month {
			intervals = append(intervals, start)
		}
		month = nextMonth
	}

	return intervals
}

type yearlyInterval struct{}

func (i *yearlyInterval) Generate(from, to time.Time) []time.Time {
	intervals := []time.Time{}
	start := time.Date(from.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(to.Year(), 1, 1, 0, 0, 0, 0, time.UTC)

	year := start.Year()
	intervals = append(intervals, start)

	for start.Before(end) {
		start = start.Add(24 * time.Hour)
		nextYear := start.Year()
		if nextYear != year {
			intervals = append(intervals, start)
		}
		year = nextYear
	}

	return intervals
}

var datePatternRegex = regexp.MustCompile("(LT|LL?L?L?|l{1,4}|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|SS?S?|X|zz?|ZZ?|Q)")

var datePatternReplacements = map[string]string{
	"M":    "1",                       // stdNumMonth 1 2 ... 11 12
	"MM":   "01",                      // stdZeroMonth 01 02 ... 11 12
	"MMM":  "Jan",                     // stdMonth Jan Feb ... Nov Dec
	"MMMM": "January",                 // stdLongMonth January February ... November December
	"D":    "2",                       // stdDay 1 2 ... 30 30
	"DD":   "02",                      // stdZeroDay 01 02 ... 30 31
	"DDD":  "<stdDayOfYear>",          // Day of the year 1 2 ... 364 365
	"DDDD": "<stdDayOfYearZero>",      // Day of the year 001 002 ... 364 365 @todo****
	"d":    "<stdDayOfWeek>",          // Numeric representation of day of the week 0 1 ... 5 6
	"dd":   "Mon",                     // ***Su Mo ... Fr Sa @todo
	"ddd":  "Mon",                     // Sun Mon ... Fri Sat
	"dddd": "Monday",                  // stdLongWeekDay Sunday Monday ... Friday Saturday
	"e":    "<stdDayOfWeek>",          // Numeric representation of day of the week 0 1 ... 5 6 @todo
	"E":    "<stdDayOfWeekISO>",       // ISO-8601 numeric representation of the day of the week (added in PHP 5.1.0) 1 2 ... 6 7 @todo
	"w":    "<stdWeekOfYear>",         // 1 2 ... 52 53
	"ww":   "<stdWeekOfYear>",         // ***01 02 ... 52 53 @todo
	"W":    "<stdWeekOfYear>",         // 1 2 ... 52 53
	"WW":   "<stdWeekOfYear>",         // ***01 02 ... 52 53 @todo
	"YY":   "06",                      // stdYear 70 71 ... 29 30
	"YYYY": "2006",                    // stdLongYear 1970 1971 ... 2029 2030
	"gg":   "<stdIsoYearShort>",       // ISO-8601 year number 70 71 ... 29 30
	"gggg": "<stdIsoYear>",            // ***1970 1971 ... 2029 2030
	"GG":   "<stdIsoYearShort>",       //70 71 ... 29 30
	"GGGG": "<stdIsoYear>",            // ***1970 1971 ... 2029 2030
	"Q":    "<stdQuarter>",            // 1, 2, 3, 4
	"A":    "PM",                      // stdPM AM PM
	"a":    "pm",                      // stdpm am pm
	"H":    "<stdHourNoZero>",         // stdHour 0 1 ... 22 23
	"HH":   "15",                      // 00 01 ... 22 23
	"h":    "3",                       // stdHour12 1 2 ... 11 12
	"hh":   "03",                      // stdZeroHour12 01 02 ... 11 12
	"m":    "4",                       // stdZeroMinute 0 1 ... 58 59
	"mm":   "04",                      // stdZeroMinute 00 01 ... 58 59
	"s":    "5",                       // stdSecond 0 1 ... 58 59
	"ss":   "05",                      // stdZeroSecond ***00 01 ... 58 59
	"z":    "MST",                     //EST CST ... MST PST
	"zz":   "MST",                     //EST CST ... MST PST
	"Z":    "Z07:00",                  // stdNumColonTZ -07:00 -06:00 ... +06:00 +07:00
	"ZZ":   "-0700",                   // stdNumTZ -0700 -0600 ... +0600 +0700
	"X":    "<stdUnix>",               // Seconds since unix epoch 1360013296
	"LT":   "3:04 PM",                 // 8:30 PM
	"L":    "01/02/2006",              //09/04/1986
	"l":    "1/2/2006",                //9/4/1986
	"ll":   "Jan 2 2006",              //Sep 4 1986
	"lll":  "Jan 2 2006 3:04 PM",      //Sep 4 1986 8:30 PM
	"llll": "Mon, Jan 2 2006 3:04 PM", //Thu, Sep 4 1986 8:30 PM
}

func formatDate(t time.Time, pattern string) string {
	var datePattern string
	base := ""
	ltr := false

	if strings.HasPrefix(pattern, "[") {
		parts := strings.Split(strings.TrimLeft(pattern, "["), "]")
		base = parts[0]
		if len(parts) == 2 {
			datePattern = parts[1]
		} else {
			datePattern = base
			base = ""
		}
		ltr = true
	} else if strings.HasSuffix(pattern, "]") {
		parts := strings.Split(strings.TrimRight(pattern, "]"), "[")
		datePattern = parts[0]
		if len(parts) == 2 {
			base = parts[1]
		} else {
			base = ""
		}
		ltr = false
	}

	formatted := t.Format(patternToLayout(datePattern))

	if strings.Contains(formatted, "<std") {
		isoYear, isoWeek := t.ISOWeek()
		isoYearShort := fmt.Sprintf("%d", isoYear)[2:4]
		formatted = strings.Replace(formatted, "<stdIsoYear>", fmt.Sprintf("%d", isoYear), -1)
		formatted = strings.Replace(formatted, "<stdIsoYearShort>", isoYearShort, -1)
		formatted = strings.Replace(formatted, "<stdWeekOfYear>", fmt.Sprintf("%02d", isoWeek), -1)

		formatted = strings.Replace(formatted, "<stdUnix>", fmt.Sprintf("%d", t.Unix()), -1)

		day := t.Weekday()
		dayOfWeekIso := int(day)
		if day == time.Sunday {
			dayOfWeekIso = 7
		}

		formatted = strings.Replace(formatted, "<stdDayOfWeek>", fmt.Sprintf("%d", day), -1)
		formatted = strings.Replace(formatted, "<stdDayOfWeekISO>", fmt.Sprintf("%d", dayOfWeekIso), -1)
		formatted = strings.Replace(formatted, "<stdDayOfYear>", fmt.Sprintf("%d", t.YearDay()), -1)

		quarter := 4

		switch t.Month() {
		case time.January, time.February, time.March:
			quarter = 1
		case time.April, time.May, time.June:
			quarter = 2
		case time.July, time.August, time.September:
			quarter = 3
		}

		formatted = strings.Replace(formatted, "<stdQuarter>", fmt.Sprintf("%d", quarter), -1)
		formatted = strings.Replace(formatted, "<stdHourNoZero>", fmt.Sprintf("%d", t.Hour()), -1)
	}

	if ltr {
		return base + formatted
	}

	return formatted + base
}

func patternToLayout(pattern string) string {
	var match [][]string
	if match = datePatternRegex.FindAllStringSubmatch(pattern, -1); match == nil {
		return pattern
	}

	for i := range match {
		if replace, ok := datePatternReplacements[match[i][0]]; ok {
			pattern = strings.Replace(pattern, match[i][0], replace, 1)
		}
	}

	return pattern
}
