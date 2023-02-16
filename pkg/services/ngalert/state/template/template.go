package template

import (
	"context"
	"math"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/pkg/timestamp"
	"github.com/prometheus/prometheus/promql"
	"github.com/prometheus/prometheus/template"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

type Labels map[string]string

// String returns the labels as k=v, comma separated, in increasing order.
func (l Labels) String() string {
	// sort the names of the labels in increasing order
	sorted := make([]string, 0, len(l))
	for k := range l {
		sorted = append(sorted, k)
	}
	sort.Strings(sorted)
	// create the string from the sorted labels
	b := strings.Builder{}
	for i, k := range sorted {
		b.WriteString(k)
		b.WriteString("=")
		b.WriteString(l[k])
		if i < len(l)-1 {
			b.WriteString(", ")
		}
	}
	return b.String()
}

// Value contains the labels and value of a Reduce, Math or Threshold
// expression for a series.
type Value struct {
	Labels Labels
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
			Labels: Labels(v.Labels),
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
