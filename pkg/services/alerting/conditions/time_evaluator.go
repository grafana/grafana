package conditions

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting"
)

// AlertTimeEvaluator evaluates the reduced value of a timeseries.
// Returning true if a timeseries is violating the condition
// ex: AnyDayTimeEvaluator, AnyTimeEvaluator, RangedTimeEvaluator
type AlertTimeEvaluator interface {
	Eval(time time.Time) bool
}

// will always return true
type anyDayTimeEvaluator struct{}

func (e *anyDayTimeEvaluator) Eval(_ time.Time) bool {
	return true
}

// will return true only on given days
type anyTimeEvaluator struct {
	Day string
}

func (e *anyTimeEvaluator) Eval(t time.Time) bool {
	return evalDay(e.Day, t)
}

// will return true only on given days at given time
type rangedTimeEvaluator struct {
	Day      string
	FromHour int
	FromMin  int
	ToHour   int
	ToMin    int
}

func (e *rangedTimeEvaluator) Eval(t time.Time) bool {
	return evalTime(e, t) && evalDay(e.Day, t)
}

func evalTime(e *rangedTimeEvaluator, time time.Time) bool {
	isWithinRange := true
	if time.Hour() < e.FromHour {
		isWithinRange = false
	} else if time.Hour() == e.FromHour {
		if time.Minute() < e.FromMin {
			isWithinRange = false
		}
	} else if time.Hour() > e.ToHour {
		isWithinRange = false
	} else if time.Hour() == e.ToHour {
		if time.Minute() > e.ToMin {
			isWithinRange = false
		}
	}
	return isWithinRange
}

// day values defined in alertDef.ts
// defaults to true
func evalDay(day string, t time.Time) bool {
	switch day {
	case "wkdy":
		switch t.Weekday() {
		case time.Monday, time.Tuesday, time.Wednesday, time.Thursday, time.Friday:
			return true
		default:
			return false
		}
	case "wknd":
		switch t.Weekday() {
		case time.Saturday, time.Sunday:
			return true
		default:
			return false
		}
	case "mon":
		return t.Weekday() == time.Monday
	case "tue":
		return t.Weekday() == time.Tuesday
	case "wed":
		return t.Weekday() == time.Wednesday
	case "thu":
		return t.Weekday() == time.Thursday
	case "fri":
		return t.Weekday() == time.Friday
	case "sat":
		return t.Weekday() == time.Saturday
	case "sun":
		return t.Weekday() == time.Sunday
	default:
		return true
	}
}

func dissectTimeParts(param string) (int, int, error) {
	timeParts := strings.Split(param, ":")
	if len(timeParts) > 2 {
		return 0, 0, alerting.ValidationError{Reason: "Time Evaluator has invalid parameter, must be HH or HH:MM"}
	}

	hour := 0
	minute := 0
	if len(timeParts) >= 1 {
		i, err := strconv.Atoi(timeParts[0])
		if err != nil {
			return 0, 0, alerting.ValidationError{Reason: "Time Evaluator has invalid parameter, must be integers"}
		}
		hour = i
	}
	if len(timeParts) == 2 {
		i, err := strconv.Atoi(timeParts[1])
		if err != nil {
			return 0, 0, alerting.ValidationError{Reason: "Time Evaluator has invalid parameter, must be integers"}
		}
		minute = i
	}

	return hour, minute, nil
}

func isTimeBefore(fromHour int, fromMin int, toHour int, toMin int) bool {
	if fromHour == toHour {
		if fromMin > toMin {
			return false
		}
	} else if fromHour > toHour {
		return false
	}
	return true
}

func newRangedTimeEvaluator(model *simplejson.Json) (*rangedTimeEvaluator, error) {
	params := model.Get("params").MustArray()
	if len(params) < 2 {
		return nil, alerting.ValidationError{Reason: "Evaluator missing threshold parameter"}
	}

	if params[0] == nil || params[1] == nil {
		return nil, alerting.ValidationError{Reason: "Evaluator missing threshold parameter"}
	}

	firstParam := params[0].(string)
	secondParam := params[1].(string)

	fromHour, fromMin, fromErr := dissectTimeParts(firstParam)
	toHour, toMin, toErr := dissectTimeParts(secondParam)

	if fromErr != nil {
		return nil, fromErr
	}
	if toErr != nil {
		return nil, toErr
	}

	// verify from is before to
	if !isTimeBefore(fromHour, fromMin, toHour, toMin) {
		return nil, alerting.ValidationError{Reason: "'From' time must be before 'To' time"}
	}

	rangedEval := &rangedTimeEvaluator{}
	rangedEval.FromHour = fromHour
	rangedEval.FromMin = fromMin
	rangedEval.ToHour = toHour
	rangedEval.ToMin = toMin

	day := model.Get("day").MustString("all")
	rangedEval.Day = day

	return rangedEval, nil
}

func newAnyTimeEvaluator(model *simplejson.Json) (AlertTimeEvaluator, error) {
	day := model.Get("day").MustString("all")

	timeEval := &anyTimeEvaluator{}
	timeEval.Day = day

	return timeEval, nil
}

// NewAlertTimeEvaluator is a factory function for returning
// an `AlertTimeEvaluator` depending on the json model.
func NewAlertTimeEvaluator(model *simplejson.Json) (AlertTimeEvaluator, error) {
	// default is to return AnyTime
	if model == nil {
		return &anyDayTimeEvaluator{}, nil
	}

	typ := model.Get("type").MustString()
	if typ == "" {
		return &anyDayTimeEvaluator{}, nil
	}

	if typ == "range" {
		return newRangedTimeEvaluator(model)
	}

	if typ == "any" {
		return newAnyTimeEvaluator(model)
	}

	return nil, fmt.Errorf("evaluator invalid evaluator type: %s", typ)
}
