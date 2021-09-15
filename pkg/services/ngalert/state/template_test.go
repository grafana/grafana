package state

import (
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	ptr "github.com/xorcare/pointer"
)

func TestTemplateCaptureValueStringer(t *testing.T) {
	cases := []struct {
		name     string
		value    templateCaptureValue
		expected string
	}{{
		name:     "nil value returns null",
		value:    templateCaptureValue{Value: nil},
		expected: "null",
	}, {
		name:     "1.0 is returned as integer value",
		value:    templateCaptureValue{Value: ptr.Float64(1.0)},
		expected: "1",
	}, {
		name:     "1.1 is returned as decimal value",
		value:    templateCaptureValue{Value: ptr.Float64(1.1)},
		expected: "1.1",
	}}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			assert.Equal(t, c.expected, c.value.String())
		})
	}
}

func TestExpandTemplate(t *testing.T) {
	cases := []struct {
		name          string
		text          string
		alertInstance eval.Result
		labels        data.Labels
		expected      string
		expectedError error
	}{{
		name:     "instance labels are expanded into $labels",
		text:     "{{ $labels.instance }} is down",
		labels:   data.Labels{"instance": "foo"},
		expected: "foo is down",
	}, {
		name:          "missing instance label returns error",
		text:          "{{ $labels.instance }} is down",
		labels:        data.Labels{},
		expectedError: errors.New("error executing template __alert_test: template: __alert_test:1:86: executing \"__alert_test\" at <$labels.instance>: map has no entry for key \"instance\""),
	}, {
		name: "values are expanded into $values",
		text: "{{ $values.A.Labels.instance }} has value {{ $values.A }}",
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:    "A",
					Labels: data.Labels{"instance": "foo"},
					Value:  ptr.Float64(10),
				},
			},
		},
		expected: "foo has value 10",
	}, {
		name: "missing label in $values returns error",
		text: "{{ $values.A.Labels.instance }} has value {{ $values.A }}",
		alertInstance: eval.Result{
			Values: map[string]eval.NumberValueCapture{
				"A": {
					Var:    "A",
					Labels: data.Labels{},
					Value:  ptr.Float64(10),
				},
			},
		},
		expectedError: errors.New("error executing template __alert_test: template: __alert_test:1:86: executing \"__alert_test\" at <$values.A.Labels.instance>: map has no entry for key \"instance\""),
	}, {
		name: "value string is expanded into $value",
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
		expectedError: errors.New(`error executing template __alert_test: template: __alert_test:1:79: executing "__alert_test" at <humanize $value>: error calling humanize: strconv.ParseFloat: parsing "invalid": invalid syntax`),
	}, {
		name: "humanize1024 float",
		text: "{{ humanize1024 $value }}",
		alertInstance: eval.Result{
			EvaluationString: "1048576.0",
		},
		expected: "1Mi",
	}, {
		name: "humanize1024 string with error",
		text: "{{ humanize1024 $value }}",
		alertInstance: eval.Result{
			EvaluationString: "invalid",
		},
		expectedError: errors.New(`error executing template __alert_test: template: __alert_test:1:79: executing "__alert_test" at <humanize1024 $value>: error calling humanize1024: strconv.ParseFloat: parsing "invalid": invalid syntax`),
	}, {
		name: "humanizeDuration - int",
		text: "{{ humanizeDuration $value }}",
		alertInstance: eval.Result{
			EvaluationString: "86400",
		},
		expected: "1d 0h 0m 0s",
	}, {
		name: "humanizeDuration - fractional subsecond",
		text: "{{ humanizeDuration $value }}",
		alertInstance: eval.Result{
			EvaluationString: ".12345",
		},
		expected: "123.5ms",
	}, {
		name: "humanizeDuration - subsecond",
		text: "{{ humanizeDuration $value }}",
		alertInstance: eval.Result{
			EvaluationString: ".0001",
		},
		expected: "100us",
	}, {
		name: "humanizeDuration - fractional seconds",
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
		expectedError: errors.New(`error executing template __alert_test: template: __alert_test:1:79: executing "__alert_test" at <humanizeDuration $value>: error calling humanizeDuration: strconv.ParseFloat: parsing "invalid": invalid syntax`),
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
		expectedError: errors.New(`error executing template __alert_test: template: __alert_test:1:91: executing "__alert_test" at <humanizePercentage>: error calling humanizePercentage: strconv.ParseFloat: parsing "invalid": invalid syntax`),
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
		name:     "match",
		text:     `{{ match "a+" "aa" }} {{ match "a+" "b" }}`,
		expected: "true false",
	}, {
		name:     "pass multiple arguments to templates",
		text:     `{{define "x"}}{{.arg0}} {{.arg1}}{{end}}{{template "x" (args 1 "2")}}`,
		expected: "1 2",
	},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			v, err := expandTemplate("test", c.text, c.labels, c.alertInstance)
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
