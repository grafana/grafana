package definitions

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func Test_SortAlertsByImportance(t *testing.T) {
	tm1, tm2 := time.Now(), time.Now().Add(time.Second)
	tc := []struct {
		name     string
		input    []Alert
		expected []Alert
	}{{
		name:     "states are sorted in expected importance",
		input:    []Alert{{State: "normal"}, {State: "nodata"}, {State: "error"}, {State: "pending"}, {State: "alerting"}},
		expected: []Alert{{State: "alerting"}, {State: "pending"}, {State: "error"}, {State: "nodata"}, {State: "normal"}},
	}, {
		name:     "same importance are sorted active alerts first",
		input:    []Alert{{State: "normal"}, {State: "normal", ActiveAt: &tm1}},
		expected: []Alert{{State: "normal", ActiveAt: &tm1}, {State: "normal"}},
	}, {
		name:     "same importance are sorted newest first",
		input:    []Alert{{State: "alerting", ActiveAt: &tm2}, {State: "alerting", ActiveAt: &tm1}},
		expected: []Alert{{State: "alerting", ActiveAt: &tm1}, {State: "alerting", ActiveAt: &tm2}},
	}, {
		name: "same importance without active time are sorted on labels",
		input: []Alert{
			{State: "normal", Labels: map[string]string{"c": "d"}},
			{State: "normal", Labels: map[string]string{"a": "b"}},
		},
		expected: []Alert{
			{State: "normal", Labels: map[string]string{"a": "b"}},
			{State: "normal", Labels: map[string]string{"c": "d"}},
		},
	}, {
		name: "same importance and active time are sorted on fewer labels",
		input: []Alert{
			{State: "alerting", ActiveAt: &tm1, Labels: map[string]string{"a": "b", "c": "d"}},
			{State: "alerting", ActiveAt: &tm1, Labels: map[string]string{"e": "f"}},
		},
		expected: []Alert{
			{State: "alerting", ActiveAt: &tm1, Labels: map[string]string{"e": "f"}},
			{State: "alerting", ActiveAt: &tm1, Labels: map[string]string{"a": "b", "c": "d"}},
		},
	}, {
		name: "same importance and active time are sorted on labels",
		input: []Alert{
			{State: "alerting", ActiveAt: &tm1, Labels: map[string]string{"c": "d"}},
			{State: "alerting", ActiveAt: &tm1, Labels: map[string]string{"a": "b"}},
		},
		expected: []Alert{
			{State: "alerting", ActiveAt: &tm1, Labels: map[string]string{"a": "b"}},
			{State: "alerting", ActiveAt: &tm1, Labels: map[string]string{"c": "d"}},
		},
	}}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			AlertsBy(AlertsByImportance).Sort(tt.input)
			assert.EqualValues(t, tt.expected, tt.input)
		})
	}
}
