package template

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"text/template"
	"time"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/timestamp"
	"github.com/prometheus/prometheus/promql"
	promTemplate "github.com/prometheus/prometheus/template"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/prom"
)

type Labels map[string]string

// String returns the labels as k=v, comma separated, in increasing order.
func (l Labels) String() string {
	sorted := make([]string, 0, len(l))
	for k := range l {
		sorted = append(sorted, k)
	}
	sort.Strings(sorted)
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

func NewValues(captures map[string]eval.NumberValueCapture) map[string]Value {
	values := make(map[string]Value)
	for refID, capture := range captures {
		var f float64
		// A RefID might be missing a value if there was no data or an error.
		// If that is the case, use "not a number". We don't use 0, or -1, as
		// either of those are possible values for a RefID.
		if capture.Value != nil {
			f = *capture.Value
		} else {
			f = math.NaN()
		}
		values[refID] = Value{
			Labels: Labels(capture.Labels),
			Value:  f,
		}
	}
	return values
}

type Data struct {
	Labels           Labels
	Values           map[string]Value
	evaluationString string

	prometheusMode       bool
	prometheusQueryValue string
}

func NewData(labels map[string]string, res eval.Result) Data {
	values := NewValues(res.Values)

	value := res.EvaluationString
	if v, ok := values[prom.QueryRefID]; ok {
		value = fmt.Sprintf("%g", v.Value)
	}

	return Data{
		Labels:               labels,
		Values:               values,
		evaluationString:     res.EvaluationString,
		prometheusQueryValue: value,
	}
}

// Value returns the value to be used in templates.
// In standard mode, it returns the full evaluation string.
// In Prometheus compatibility mode (when _prometheusMode function is called),
// it returns only the numeric value of the query result.
func (d Data) Value() string {
	if d.prometheusMode {
		return d.prometheusQueryValue
	} else {
		return d.evaluationString
	}
}

// makePrometheusModeFunc returns a template function that when called, switches the template
// rendering to Prometheus compatibility mode. In this mode, $value and .Value will return
// the numeric value of the query result instead of the full evaluation string.
//
// This function is primarily used when converting Prometheus alert rules to Grafana
// to maintain compatibility with existing Prometheus templates that expect
// $value and .Value to behave like in Prometheus.
func makePrometheusModeFunc(d *Data) func() string {
	return func() string {
		d.prometheusMode = true
		return ""
	}
}

// ExpandError is an error containing the template and the error that occurred
// while expanding it.
type ExpandError struct {
	Tmpl string
	Err  error
}

func (e ExpandError) Error() string {
	return fmt.Sprintf("failed to expand template '%s': %s", e.Tmpl, e.Err)
}

func Expand(ctx context.Context, name, tmpl string, data Data, externalURL *url.URL, evaluatedAt time.Time) (string, error) {
	if !strings.Contains(tmpl, "{{") { // If it is not a template, skip expanding it.
		return tmpl, nil
	}

	// add __alert_ to avoid possible conflicts with other templates
	name = "__alert_" + name
	// add variables for the labels and values to the beginning of the template

	// if the template starts with {{ _prometheusMode }}, we need to add the variables after that
	// to override the $value.
	if strings.HasPrefix(tmpl, prom.PrometheusModeTemplateCall) {
		tmpl = prom.PrometheusModeTemplateCall + "{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}" + tmpl[len(prom.PrometheusModeTemplateCall):]
	} else {
		tmpl = "{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}" + tmpl
	}
	// ctx and queryFunc are no-ops as `query()` is not supported in Grafana
	queryFunc := func(context.Context, string, time.Time) (promql.Vector, error) {
		return nil, nil
	}
	tm := model.Time(timestamp.FromTime(evaluatedAt))
	// Use missingkey=invalid so missing data shows <no value> instead of the type's default value
	options := []string{"missingkey=invalid"}

	expander := promTemplate.NewTemplateExpander(ctx, tmpl, name, &data, tm, queryFunc, externalURL, options)
	expander.Funcs(defaultFuncs)
	expander.Funcs(template.FuncMap{
		"_prometheusMode": makePrometheusModeFunc(&data),
	})

	result, err := expander.Expand()
	if err != nil {
		return "", ExpandError{Tmpl: tmpl, Err: err}
	}

	// We need to replace <no value> with [no value] as some integrations think <no value> is invalid HTML. For example,
	// Telegram in HTML mode rejects messages with unsupported tags.
	result = strings.ReplaceAll(result, "<no value>", "[no value]")
	return result, nil
}
