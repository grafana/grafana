package state

import (
	"context"
	"strconv"
	"time"

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
	Value  *float64
}

// String implements the Stringer interface to print the value of each RefID
// in the template via {{ $values.A }} rather than {{ $values.A.Value }}.
func (v templateCaptureValue) String() string {
	if v.Value != nil {
		return strconv.FormatFloat(*v.Value, 'f', -1, 64)
	}
	return "null"
}

func expandTemplate(name, text string, labels map[string]string, alertInstance eval.Result) (result string, resultErr error) {
	name = "__alert_" + name
	text = "{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}" + text
	data := struct {
		Labels map[string]string
		Values map[string]templateCaptureValue
		Value  string
	}{
		Labels: labels,
		Values: newTemplateCaptureValueMap(alertInstance.Values),
		Value:  alertInstance.EvaluationString,
	}

	expander := template.NewTemplateExpander(
		context.TODO(),
		text,
		name,
		data,
		model.Time(timestamp.FromTime(time.Now())),
		func(context.Context, string, time.Time) (promql.Vector, error) {
			return nil, nil
		},
		nil,
		[]string{"missingkey=error"},
	)

	return expander.Expand()
}

func newTemplateCaptureValueMap(values map[string]eval.NumberValueCapture) map[string]templateCaptureValue {
	m := make(map[string]templateCaptureValue)
	for k, v := range values {
		m[k] = templateCaptureValue{
			Labels: v.Labels,
			Value:  v.Value,
		}
	}
	return m
}
