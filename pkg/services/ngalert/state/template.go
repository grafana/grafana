package state

import (
	"context"
	"math"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/pkg/timestamp"
	"github.com/prometheus/prometheus/promql"
	"github.com/prometheus/prometheus/template"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
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

func expandTemplate(ctx context.Context, name, text string, labels map[string]string, alertInstance eval.Result, externalURL *url.URL) (result string, resultErr error) {
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
		ctx, // This context is only used with the `query()` function - which we don't support yet.
		text,
		name,
		data,
		model.Time(timestamp.FromTime(alertInstance.EvaluatedAt)),
		func(context.Context, string, time.Time) (promql.Vector, error) {
			return nil, nil
		},
		externalURL,
		[]string{"missingkey=invalid"},
	)

	expander.Funcs(FuncMap)
	result, resultErr = expander.Expand()
	// Replace missing key value to one that does not look like an HTML tag. This can cause problems downstream in some notifiers.
	// For example, Telegram in HTML mode rejects requests with unsupported tags.
	result = strings.ReplaceAll(result, "<no value>", "[no value]")
	return result, resultErr
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

type query struct {
	Datasource string `json:"datasource"`
	Expr       string `json:"expr"`
}
