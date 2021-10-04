package state

import (
	"context"
	"math"
	"net/url"
	"strconv"
	"time"

	text_template "text/template"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/pkg/timestamp"
	"github.com/prometheus/prometheus/promql"
	"github.com/prometheus/prometheus/template"
)

// templateCaptureValue represents each value in .Values in the annotations
// and labels template.
type templateCaptureValue struct {
	Labels map[string]string
	Value  float64
}

// String implements the Stringer interface to print the value of each RefID
// in the template via {{ $values.A }} rather than {{ $values.A.Value }}.
func (v templateCaptureValue) String() string {
	return strconv.FormatFloat(v.Value, 'f', -1, 64)
}

func expandTemplate(name, text string, labels map[string]string, alertInstance eval.Result, externalURL *url.URL) (result string, resultErr error) {
	name = "__alert_" + name
	text = "{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}" + text
	data := struct {
		Labels map[string]string
		Values map[string]templateCaptureValue
		Value  string
	}{
		Labels: labels,
		Values: newTemplateCaptureValues(alertInstance.Values),
		Value:  alertInstance.EvaluationString,
	}

	expander := template.NewTemplateExpander(
		context.TODO(), // This context is only used with the `query()` function - which we don't support yet.
		text,
		name,
		data,
		model.Time(timestamp.FromTime(alertInstance.EvaluatedAt)),
		func(context.Context, string, time.Time) (promql.Vector, error) {
			return nil, nil
		},
		externalURL,
		[]string{"missingkey=error"},
	)

	expander.Funcs(text_template.FuncMap{
		// These three functions are no-ops for now.
		"strvalue": func(value templateCaptureValue) string {
			return ""
		},
		"graphLink": func() string {
			return ""
		},
		"tableLink": func() string {
			return ""
		},
	})

	return expander.Expand()
}

func newTemplateCaptureValues(values map[string]eval.NumberValueCapture) map[string]templateCaptureValue {
	m := make(map[string]templateCaptureValue)
	for k, v := range values {
		var f float64
		if v.Value != nil {
			f = *v.Value
		} else {
			f = math.NaN()
		}
		m[k] = templateCaptureValue{
			Labels: v.Labels,
			Value:  f,
		}
	}
	return m
}
