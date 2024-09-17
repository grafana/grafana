package definitions

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestDiscoveryBaseHTTPStatusCode(t *testing.T) {
	tc := []struct {
		name     string
		input    DiscoveryBase
		expected int
	}{{
		name: "OK when status is success",
		input: DiscoveryBase{
			Status: "success",
		},
		expected: http.StatusOK,
	}, {
		name: "InternalServerError when status is error but no error type",
		input: DiscoveryBase{
			Status: "error",
		},
		expected: http.StatusInternalServerError,
	}, {
		name: "BadRequest when status is error and type is bad_data",
		input: DiscoveryBase{
			Status:    "error",
			ErrorType: "bad_data",
		},
		expected: http.StatusBadRequest,
	}, {
		name: "InternalServerError when status is error and type is server_error",
		input: DiscoveryBase{
			Status:    "error",
			ErrorType: "server_error",
		},
		expected: http.StatusInternalServerError,
	}}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			assert.EqualValues(t, tt.expected, tt.input.HTTPStatusCode())
		})
	}
}

func TestSortAlertsByImportance(t *testing.T) {
	tm1, tm2 := time.Now(), time.Now().Add(time.Second)
	tc := []struct {
		name     string
		input    []Alert
		expected []Alert
	}{{
		name:     "alerts are ordered in expected importance",
		input:    []Alert{{State: "normal"}, {State: "nodata"}, {State: "error"}, {State: "pending"}, {State: "alerting"}},
		expected: []Alert{{State: "alerting"}, {State: "pending"}, {State: "error"}, {State: "nodata"}, {State: "normal"}},
	}, {
		name:     "alerts with same importance are ordered active first",
		input:    []Alert{{State: "normal"}, {State: "normal", ActiveAt: &tm1}},
		expected: []Alert{{State: "normal", ActiveAt: &tm1}, {State: "normal"}},
	}, {
		name:     "active alerts with same importance are ordered newest first",
		input:    []Alert{{State: "alerting", ActiveAt: &tm2}, {State: "alerting", ActiveAt: &tm1}},
		expected: []Alert{{State: "alerting", ActiveAt: &tm1}, {State: "alerting", ActiveAt: &tm2}},
	}, {
		name: "inactive alerts with same importance are ordered by labels",
		input: []Alert{
			{State: "normal", Labels: LabelsFromMap(map[string]string{"c": "d"})},
			{State: "normal", Labels: LabelsFromMap(map[string]string{"a": "b"})},
		},
		expected: []Alert{
			{State: "normal", Labels: LabelsFromMap(map[string]string{"a": "b"})},
			{State: "normal", Labels: LabelsFromMap(map[string]string{"c": "d"})},
		},
	}, {
		name: "active alerts with same importance and active time are ordered by label names",
		input: []Alert{
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"c": "d", "e": "f"})},
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"a": "b"})},
		},
		expected: []Alert{
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"a": "b"})},
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"c": "d", "e": "f"})},
		},
	}, {
		name: "active alerts with same importance and active time are ordered by labels",
		input: []Alert{
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"c": "d"})},
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"a": "b"})},
		},
		expected: []Alert{
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"a": "b"})},
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"c": "d"})},
		},
	}, {
		name: "active alerts with same importance and active time are ordered by label values",
		input: []Alert{
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"x": "b"})},
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"x": "a"})},
		},
		expected: []Alert{
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"x": "a"})},
			{State: "alerting", ActiveAt: &tm1, Labels: LabelsFromMap(map[string]string{"x": "b"})},
		},
	}}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			AlertsBy(AlertsByImportance).Sort(tt.input)
			assert.EqualValues(t, tt.expected, tt.input)
		})
	}
}

func TestTopKAlertsByImportance(t *testing.T) {
	tc := []struct {
		name     string
		k        int
		input    []Alert
		expected []Alert
	}{{
		name:     "no alerts are returned (k=0)",
		k:        0,
		input:    []Alert{{State: "normal"}, {State: "nodata"}, {State: "error"}, {State: "pending"}, {State: "alerting"}},
		expected: []Alert{},
	}, {
		name:     "alerts are ordered in expected importance (k=1)",
		k:        1,
		input:    []Alert{{State: "normal"}, {State: "nodata"}, {State: "error"}, {State: "pending"}, {State: "alerting"}},
		expected: []Alert{{State: "alerting"}},
	}, {
		name:     "alerts are ordered in expected importance (k=2)",
		k:        2,
		input:    []Alert{{State: "normal"}, {State: "nodata"}, {State: "error"}, {State: "pending"}, {State: "alerting"}},
		expected: []Alert{{State: "alerting"}, {State: "pending"}},
	}, {
		name:     "alerts are ordered in expected importance (k=3)",
		k:        3,
		input:    []Alert{{State: "normal"}, {State: "nodata"}, {State: "error"}, {State: "pending"}, {State: "alerting"}},
		expected: []Alert{{State: "alerting"}, {State: "pending"}, {State: "error"}},
	}, {
		name:     "alerts are ordered in expected importance (k=4)",
		k:        4,
		input:    []Alert{{State: "normal"}, {State: "nodata"}, {State: "error"}, {State: "pending"}, {State: "alerting"}},
		expected: []Alert{{State: "alerting"}, {State: "pending"}, {State: "error"}, {State: "nodata"}},
	}, {
		name:     "alerts are ordered in expected importance (k=5)",
		k:        5,
		input:    []Alert{{State: "normal"}, {State: "nodata"}, {State: "error"}, {State: "pending"}, {State: "alerting"}},
		expected: []Alert{{State: "alerting"}, {State: "pending"}, {State: "error"}, {State: "nodata"}, {State: "normal"}},
	}, {
		name:     "alerts are ordered in expected importance (k=6)",
		k:        6,
		input:    []Alert{{State: "normal"}, {State: "nodata"}, {State: "error"}, {State: "pending"}, {State: "alerting"}},
		expected: []Alert{{State: "alerting"}, {State: "pending"}, {State: "error"}, {State: "nodata"}, {State: "normal"}},
	},
	}

	for _, tt := range tc {
		t.Run(tt.name, func(t *testing.T) {
			result := AlertsBy(AlertsByImportance).TopK(tt.input, tt.k)
			assert.EqualValues(t, tt.expected, result)
		})
	}
}
