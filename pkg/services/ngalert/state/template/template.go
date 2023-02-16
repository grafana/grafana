package template

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

// Value contains the labels and value of a Reduce, Math or Threshold
// expression for a series.
type Value struct {
	Labels map[string]string
	Value  float64
}

func (v Value) String() string {
	return strconv.FormatFloat(v.Value, 'f', -1, 64)
}

func NewValues(values map[string]eval.NumberValueCapture) map[string]Value {
	m := make(map[string]Value)
	for k, v := range values {
		var f float64
		if v.Value != nil {
			f = *v.Value
		} else {
			f = math.NaN()
		}
		m[k] = Value{
			Labels: v.Labels,
			Value:  f,
		}
	}
	return m
}

func Expand(
	ctx context.Context,
	name, tmpl string,
	labels map[string]string,
	res eval.Result,
	externalURL *url.URL) (string, error) {
	name = "__alert_" + name
	tmpl = "{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}" + tmpl
	data := struct {
		Labels map[string]string
		Values map[string]Value
		Value  string
	}{
		Labels: labels,
		Values: NewValues(res.Values),
		Value:  res.EvaluationString,
	}

	expander := template.NewTemplateExpander(
		ctx, // This context is only used with the `query()` function - which we don't support yet.
		tmpl,
		name,
		data,
		model.Time(timestamp.FromTime(res.EvaluatedAt)),
		func(context.Context, string, time.Time) (promql.Vector, error) {
			return nil, nil
		},
		externalURL,
		[]string{"missingkey=invalid"},
	)
	expander.Funcs(defaultFuncs)

	result, err := expander.Expand()
	// Replace missing key value to one that does not look like an HTML tag. This can cause problems downstream in some notifiers.
	// For example, Telegram in HTML mode rejects requests with unsupported tags.
	result = strings.ReplaceAll(result, "<no value>", "[no value]")

	return result, err
}
