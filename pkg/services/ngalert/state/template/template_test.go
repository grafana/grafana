package template

import (
	"context"
	"errors"
	"math"
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/util"
)

func TestLabelsString(t *testing.T) {
	tests := []struct {
		name     string
		labels   Labels
		expected string
	}{{
		name:     "single label has no commas",
		labels:   Labels{"foo": "bar"},
		expected: "foo=bar",
	}, {
		name:     "labels are sorted in increasing order",
		labels:   Labels{"foo": "bar", "bar": "baz"},
		expected: "bar=baz, foo=bar",
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, test.labels.String())
		})
	}
}

func TestValueString(t *testing.T) {
	tests := []struct {
		name     string
		value    Value
		expected string
	}{{
		name:     "0 is returned as integer value",
		value:    Value{Value: 0},
		expected: "0",
	}, {
		name:     "1.0 is returned as integer value",
		value:    Value{Value: 1.0},
		expected: "1",
	}, {
		name:     "1.1 is returned as decimal value",
		value:    Value{Value: 1.1},
		expected: "1.1",
	}, {
		name:     "1.1 is returned as decimal value, no labels",
		value:    Value{Labels: map[string]string{"foo": "bar"}, Value: 1.1},
		expected: "1.1",
	}}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, test.value.String())
		})
	}
}

func TestExpandError(t *testing.T) {
	err := ExpandError{Tmpl: "{{", Err: errors.New("unexpected {{")}
	assert.Equal(t, "failed to expand template '{{': unexpected {{", err.Error())
}

func TestNewData(t *testing.T) {
	t.Run("uses evaluation string when no datasource nodes", func(t *testing.T) {
		res := eval.Result{
			EvaluationString: "[ var='A' labels={instance=foo} value=10 ]",
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					IsDatasourceNode: false,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(10.0),
				},
			},
		}

		data := NewData(map[string]string{}, res)
		assert.Equal(t, "[ var='A' labels={instance=foo} value=10 ]", data.Value)
	})

	t.Run("uses single datasource node value when exactly one exists", func(t *testing.T) {
		res := eval.Result{
			EvaluationString: "[ var='A' labels={instance=foo} value=10 ]",
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(10.0),
				},
				"B": {
					Var:              "B",
					IsDatasourceNode: false,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(20.0),
				},
			},
		}

		data := NewData(map[string]string{}, res)
		assert.Equal(t, 10.0, data.Value)
	})

	t.Run("uses evaluation string when multiple datasource nodes exist", func(t *testing.T) {
		res := eval.Result{
			EvaluationString: "[ var='A' labels={instance=foo} value=10 ]",
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(10.0),
				},
				"B": {
					Var:              "B",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "bar"},
					Value:            util.Pointer(20.0),
				},
			},
		}

		data := NewData(map[string]string{}, res)
		assert.Equal(t, "[ var='A' labels={instance=foo} value=10 ]", data.Value)
	})
}

// TestDatasourceValueInTemplating tests the behavior of the $value variable in alert templates.
// $value behavior has been changed to return a numeric value from the datasource query
// when only a single datasource is used in the alerting rule. If more datasources are used,
// $value will return the evaluation string.
//
// This change makes Grafana's templating more compatible with Prometheus templating,
// where $value and .Value return the numeric value of the alert query.
func TestDatasourceValueInTemplating(t *testing.T) {
	t.Run("nil datasource value is rendered as NaN", func(t *testing.T) {
		res := eval.Result{
			EvaluationString: "[ var='A' labels={instance=foo} value=no data ]",
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "foo"},
					Value:            nil, // nil value
				},
			},
		}

		data := NewData(map[string]string{}, res)
		// In Prometheus, a nil value would be rendered as NaN
		assert.True(t, math.IsNaN(data.Value.(float64)))
	})

	t.Run("single datasource node uses query value", func(t *testing.T) {
		res := eval.Result{
			EvaluationString: "[ var='A' labels={instance=foo} value=10, var='B' labels={instance=foo} value=20, var='C' labels={instance=foo} value=30 ]",
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(10.0),
				},
				"B": {
					Var:              "B",
					IsDatasourceNode: false,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(20.0),
				},
				"C": {
					Var:              "C",
					IsDatasourceNode: false,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(30.0),
				},
			},
		}

		data := NewData(map[string]string{}, res)
		assert.Equal(t, 10.0, data.Value)
	})

	t.Run("multiple datasource nodes uses evaluation string", func(t *testing.T) {
		evalStr := "[ var='A' labels={instance=foo} value=10, var='B' labels={instance=foo} value=20, var='C' labels={instance=foo} value=30 ]"
		res := eval.Result{
			EvaluationString: evalStr,
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(10.0),
				},
				"B": {
					Var:              "B",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(20.0),
				},
				"C": {
					Var:              "C",
					IsDatasourceNode: false,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(30.0),
				},
			},
		}

		data := NewData(map[string]string{}, res)
		assert.Equal(t, evalStr, data.Value)
	})
}

func TestExpandTemplate(t *testing.T) {
	pathPrefix := "/path/prefix"
	externalURL, err := url.Parse("http://localhost" + pathPrefix)
	assert.NoError(t, err)

	cases := []struct {
		name          string
		text          string
		alertInstance eval.Result
		labels        data.Labels
		expected      string
		expectedError error
	}{{
		name:     "labels are expanded into $labels",
		text:     "{{ $labels.instance }} is down",
		labels:   data.Labels{"instance": "foo"},
		expected: "foo is down",
	}, {
		name:     "missing label in $labels returns [no value]",
		text:     "{{ $labels.instance }} is down",
		labels:   data.Labels{},
		expected: "[no value] is down",
	}, {
		name: "values are expanded into $values",
		text: "{{ $values.A.Labels.instance }} has value {{ $values.A }}",
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:    "A",
					Labels: data.Labels{"instance": "foo"},
					Value:  util.Pointer(1.0),
				},
			},
		},
		expected: "foo has value 1",
	}, {
		name: "values can be passed to template functions such as printf",
		text: "{{ $values.A.Labels.instance }} has value {{ $values.A.Value | printf \"%.1f\" }}",
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(1.1),
					IsDatasourceNode: true,
				},
			},
		},
		expected: "foo has value 1.1",
	}, {
		name: "missing label in $values returns [no value]",
		text: "{{ $values.A.Labels.instance }} has value {{ $values.A }}",
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					Labels:           data.Labels{},
					Value:            util.Pointer(1.0),
					IsDatasourceNode: true,
				},
			},
		},
		expected: "[no value] has value 1",
	}, {
		name: "missing value in $values is returned as NaN",
		text: "{{ $values.A.Labels.instance }} has value {{ $values.A }}",
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:    "A",
					Labels: data.Labels{"instance": "foo"},
					Value:  nil,
				},
			},
		},
		expected: "foo has value NaN",
	}, {
		name: "$value is expanded into a number for a single datasource query",
		text: `
			current $value is: {{ $value }}
			current .Value is: {{ .Value }}
		`,
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"query": {
					Var:              "query",
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(10.123),
					IsDatasourceNode: true,
				},
				"math": {
					Var:              "math",
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(10.0),
					IsDatasourceNode: false,
				},
			},
			EvaluationString: "[ var='query' labels={instance=foo} value=10.123, var='math' labels={instance=foo} value=10 ]",
		},
		expected: `current $value is: 10.123
			current .Value is: 10.123
		`,
	}, {
		name: "$value is expanded into a string for multi-datasource query",
		text: `
			current $value is: {{ $value }}
			current .Value is: {{ .Value }}
		`,
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"query": {
					Var:              "query",
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(10.123),
					IsDatasourceNode: true,
				},
				"second-query": {
					Var:              "second-query",
					Labels:           data.Labels{"instance": "bar"},
					Value:            util.Pointer(20.456),
					IsDatasourceNode: true,
				},
			},
			EvaluationString: "[ var='query' labels={instance=foo} value=10.123, var='second-query' labels={instance=bar} value=20.456 ]",
		},
		expected: `current $value is: [ var='query' labels={instance=foo} value=10.123, var='second-query' labels={instance=bar} value=20.456 ]
			current .Value is: [ var='query' labels={instance=foo} value=10.123, var='second-query' labels={instance=bar} value=20.456 ]
		`,
	}, {
		name: "assert value string is expanded into $value",
		text: "{{ $value }}",
		alertInstance: eval.Result{
			EvaluationString: "[ var='A' labels={instance=foo} value=10 ]",
		},
		expected: "[ var='A' labels={instance=foo} value=10 ]",
	}, {
		name: "float64 is humanized correctly",
		text: "{{ humanize $value }}",
		alertInstance: eval.Result{
			EvaluationString: "1234567.0",
		},
		expected: "1.235M",
	}, {
		name: "int is humanized correctly",
		text: "{{ humanize $value }}",
		alertInstance: eval.Result{
			EvaluationString: "1234567",
		},
		expected: "1.235M",
	}, {
		name: "humanize string with error",
		text: `{{ humanize $value }}`,
		alertInstance: eval.Result{
			EvaluationString: "invalid",
		},
		expectedError: errors.New(`failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}{{ humanize $value }}': error executing template __alert_test: template: __alert_test:1:79: executing "__alert_test" at <humanize $value>: error calling humanize: strconv.ParseFloat: parsing "invalid": invalid syntax`),
	}, {
		name: "humanize1024 float64",
		text: "{{ range $key, $val := $values }}{{ humanize1024 .Value }}:{{ end }}",
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:    "A",
					Labels: data.Labels{},
					Value:  util.Pointer(0.0),
				},
				"B": {
					Var:    "B",
					Labels: data.Labels{},
					Value:  util.Pointer(1.0),
				},
				"C": {
					Var:    "C",
					Labels: data.Labels{},
					Value:  util.Pointer(1048576.0),
				},
				"D": {
					Var:    "D",
					Labels: data.Labels{},
					Value:  util.Pointer(.12),
				},
			},
		},
		expected: "0:1:1Mi:0.12:",
	}, {
		name: "humanize1024 string with error",
		text: "{{ humanize1024 $value }}",
		alertInstance: eval.Result{
			EvaluationString: "invalid",
		},
		expectedError: errors.New(`failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}{{ humanize1024 $value }}': error executing template __alert_test: template: __alert_test:1:79: executing "__alert_test" at <humanize1024 $value>: error calling humanize1024: strconv.ParseFloat: parsing "invalid": invalid syntax`),
	}, {
		name: "humanizeDuration - seconds - float64",
		text: "{{ range $key, $val := $values }}{{ humanizeDuration .Value }}:{{ end }}",
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:    "A",
					Labels: data.Labels{},
					Value:  util.Pointer(0.0),
				},
				"B": {
					Var:    "B",
					Labels: data.Labels{},
					Value:  util.Pointer(1.0),
				},
				"C": {
					Var:    "C",
					Labels: data.Labels{},
					Value:  util.Pointer(60.0),
				},
				"D": {
					Var:    "D",
					Labels: data.Labels{},
					Value:  util.Pointer(3600.0),
				},
				"E": {
					Var:    "E",
					Labels: data.Labels{},
					Value:  util.Pointer(86400.0),
				},
				"F": {
					Var:    "F",
					Labels: data.Labels{},
					Value:  util.Pointer(86400.0 + 3600.0),
				},
				"G": {
					Var:    "G",
					Labels: data.Labels{},
					Value:  util.Pointer(-(86400*2 + 3600*3 + 60*4 + 5.0)),
				},
				"H": {
					Var:    "H",
					Labels: data.Labels{},
					Value:  util.Pointer(899.99),
				},
			},
		},
		expected: "0s:1s:1m 0s:1h 0m 0s:1d 0h 0m 0s:1d 1h 0m 0s:-2d 3h 4m 5s:14m 59s:",
	}, {
		name: "humanizeDuration - string",
		text: "{{ humanizeDuration $value }}",
		alertInstance: eval.Result{
			EvaluationString: "86400",
		},
		expected: "1d 0h 0m 0s",
	}, {
		name: "humanizeDuration - subsecond and fractional seconds - float64",
		text: "{{ range $key, $val := $values }}{{ humanizeDuration .Value }}:{{ end }}",
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:    "A",
					Labels: data.Labels{},
					Value:  util.Pointer(.1),
				},
				"B": {
					Var:    "B",
					Labels: data.Labels{},
					Value:  util.Pointer(.0001),
				},
				"C": {
					Var:    "C",
					Labels: data.Labels{},
					Value:  util.Pointer(.12345),
				},
				"D": {
					Var:    "D",
					Labels: data.Labels{},
					Value:  util.Pointer(60.1),
				},
				"E": {
					Var:    "E",
					Labels: data.Labels{},
					Value:  util.Pointer(60.5),
				},
				"F": {
					Var:    "F",
					Labels: data.Labels{},
					Value:  util.Pointer(1.2345),
				},
				"G": {
					Var:    "G",
					Labels: data.Labels{},
					Value:  util.Pointer(12.345),
				},
			},
		},
		expected: "100ms:100us:123.5ms:1m 0s:1m 0s:1.234s:12.35s:",
	}, {
		name: "humanizeDuration - subsecond - string",
		text: "{{ humanizeDuration $value }}",
		alertInstance: eval.Result{
			EvaluationString: ".0001",
		},
		expected: "100us",
	}, {
		name: "humanizeDuration - fractional seconds - string",
		text: "{{ humanizeDuration $value }}",
		alertInstance: eval.Result{
			EvaluationString: "1.2345",
		},
		expected: "1.234s",
	}, {
		name: "humanizeDuration - string with error",
		text: `{{ humanizeDuration $value }}`,
		alertInstance: eval.Result{
			EvaluationString: "invalid",
		},
		expectedError: errors.New(`failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}{{ humanizeDuration $value }}': error executing template __alert_test: template: __alert_test:1:79: executing "__alert_test" at <humanizeDuration $value>: error calling humanizeDuration: strconv.ParseFloat: parsing "invalid": invalid syntax`),
	}, {
		name:     "humanizePercentage - float64",
		text:     "{{ -0.22222 | humanizePercentage }}:{{ 0.0 | humanizePercentage }}:{{ 0.1234567 | humanizePercentage }}:{{ 1.23456 | humanizePercentage }}",
		expected: "-22.22%:0%:12.35%:123.5%",
	}, {
		name:     "humanizePercentage - string",
		text:     `{{ "-0.22222" | humanizePercentage }}:{{ "0.0" | humanizePercentage }}:{{ "0.1234567" | humanizePercentage }}:{{ "1.23456" | humanizePercentage }}`,
		expected: "-22.22%:0%:12.35%:123.5%",
	}, {
		name:          "humanizePercentage - string with error",
		text:          `{{ "invalid" | humanizePercentage }}`,
		expectedError: errors.New(`failed to expand template '{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}{{ "invalid" | humanizePercentage }}': error executing template __alert_test: template: __alert_test:1:91: executing "__alert_test" at <humanizePercentage>: error calling humanizePercentage: strconv.ParseFloat: parsing "invalid": invalid syntax`),
	}, {
		name:     "humanizeTimestamp - float64",
		text:     "{{ 1435065584.128 | humanizeTimestamp }}",
		expected: "2015-06-23 13:19:44.128 +0000 UTC",
	}, {
		name:     "humanizeTimestamp - string",
		text:     `{{ "1435065584.128" | humanizeTimestamp }}`,
		expected: "2015-06-23 13:19:44.128 +0000 UTC",
	}, {
		name:     "title",
		text:     `{{ "aa bb CC" | title }}`,
		expected: "Aa Bb CC",
	}, {
		name:     "toUpper",
		text:     `{{ "aa bb CC" | toUpper }}`,
		expected: "AA BB CC",
	}, {
		name:     "toLower",
		text:     `{{ "aA bB CC" | toLower }}`,
		expected: "aa bb cc",
	}, {
		name:     "match",
		text:     `{{ match "a+" "aa" }} {{ match "a+" "b" }}`,
		expected: "true false",
	}, {
		name:     "regex replacement",
		text:     "{{ reReplaceAll \"(a)b\" \"x$1\" \"ab\" }}",
		expected: "xa",
	}, {
		name:     "pass multiple arguments to templates",
		text:     `{{define "x"}}{{.arg0}} {{.arg1}}{{end}}{{template "x" (args 1 "2")}}`,
		expected: "1 2",
	}, {
		name:     "pathPrefix",
		text:     "{{ pathPrefix }}",
		expected: pathPrefix,
	}, {
		name:     "externalURL",
		text:     "{{ externalURL }}",
		expected: externalURL.String(),
	}, {
		name:     "check that query, first and value don't error or panic",
		text:     "{{ query \"1.5\" | first | value }}",
		expected: "",
	}, {
		name:     "check that label doesn't error or panic",
		text:     "{{ query \"metric{instance='a'}\" | first | label \"instance\" }}",
		expected: "",
	}, {
		name:     "graphLink",
		text:     `{{ graphLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}`,
		expected: `/explore?left={"datasource":"gdev-prometheus","queries":[{"datasource":"gdev-prometheus","expr":"up","instant":false,"range":true,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`,
	}, {
		name:     "graphLink should escape both the expression and the datasource",
		text:     `{{ graphLink "{\"expr\": \"process_open_fds > 0\", \"datasource\": \"gdev prometheus\"}" }}`,
		expected: `/explore?left={"datasource":"gdev+prometheus","queries":[{"datasource":"gdev+prometheus","expr":"process_open_fds+%3E+0","instant":false,"range":true,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`,
	}, {
		name:     "check that graphLink returns an empty string when the query is not formatted correctly",
		text:     "{{ graphLink \"up\" }}",
		expected: "",
	}, {
		name:     "tableLink",
		text:     `{{ tableLink "{\"expr\": \"up\", \"datasource\": \"gdev-prometheus\"}" }}`,
		expected: `/explore?left={"datasource":"gdev-prometheus","queries":[{"datasource":"gdev-prometheus","expr":"up","instant":true,"range":false,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`,
	}, {
		name:     "tableLink should escape both the expression and the datasource",
		text:     `{{ tableLink "{\"expr\": \"process_open_fds > 0\", \"datasource\": \"gdev prometheus\"}" }}`,
		expected: `/explore?left={"datasource":"gdev+prometheus","queries":[{"datasource":"gdev+prometheus","expr":"process_open_fds+%3E+0","instant":true,"range":false,"refId":"A"}],"range":{"from":"now-1h","to":"now"}}`,
	}, {
		name:     "check that tableLink returns an empty string  when the query is not formatted correctly",
		text:     "{{ tableLink \"up\" }}",
		expected: "",
	}, {
		name:     "check that sortByLabel doesn't error or panic",
		text:     "{{ query \"metric{__value__='a'}\" | sortByLabel }}",
		expected: "",
	}, {
		name: "check that strvalue returns an empty string (for now)",
		text: "{{ $values.A | strvalue }}",
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:    "A",
					Labels: data.Labels{"__value__": "foo"},
				},
			},
		},
		expected: "",
	}, {
		name:     "check that safeHtml doesn't error or panic",
		text:     "{{ \"<b>\" | safeHtml }}",
		expected: "<b>",
	}, {
		name: "$value numeric comparison with single datasource",
		text: `{{ if eq $value 1.0 }}equal{{ else }}not equal{{ end }}`,
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(1.0),
				},
			},
		},
		expected: "equal",
	}, {
		name: "humanize with string $value (multiple datasources)",
		text: `{{ humanize $value }}`,
		alertInstance: eval.Result{
			EvaluationString: "1234567.0",
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(10.0),
				},
				"B": {
					Var:              "B",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "bar"},
					Value:            util.Pointer(20.0),
				},
			},
		},
		expected: "1.235M",
	}, {
		name: "humanize with numeric $value (single datasource)",
		text: `{{ humanize $value }}`,
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:              "A",
					IsDatasourceNode: true,
					Labels:           data.Labels{"instance": "foo"},
					Value:            util.Pointer(1234567.0),
				},
			},
		},
		expected: "1.235M",
	}}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v, err := Expand(context.Background(), "test", c.text, NewData(c.labels, c.alertInstance), externalURL, c.alertInstance.EvaluatedAt)
			if c.expectedError != nil {
				require.NotNil(t, err)
				require.EqualError(t, c.expectedError, err.Error())
			} else {
				require.Nil(t, c.expectedError)
			}
			require.Equal(t, c.expected, v)
		})
	}
}
