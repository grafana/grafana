package template

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/timestamp"
	"github.com/prometheus/prometheus/promql"
	"github.com/prometheus/prometheus/template"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
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
	Labels Labels
	Values map[string]Value
	Value  string
}

func NewData(labels map[string]string, res eval.Result) Data {
	return Data{
		Labels: labels,
		Values: NewValues(res.Values),
		Value:  res.EvaluationString,
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
	// add __alert_ to avoid possible conflicts with other templates
	name = "__alert_" + name
	// add variables for the labels and values to the beginning of the template
	tmpl = "{{- $labels := .Labels -}}{{- $values := .Values -}}{{- $value := .Value -}}" + tmpl
	// ctx and queryFunc are no-ops as `query()` is not supported in Grafana
	queryFunc := func(context.Context, string, time.Time) (promql.Vector, error) {
		return nil, nil
	}
	tm := model.Time(timestamp.FromTime(evaluatedAt))
	// Use missingkey=invalid so missing data shows <no value> instead of the type's default value
	options := []string{"missingkey=invalid"}

	expander := template.NewTemplateExpander(ctx, tmpl, name, data, tm, queryFunc, externalURL, options)
	expander.Funcs(defaultFuncs)

	result, err := expander.Expand()
	if err != nil {
		return "", ExpandError{Tmpl: tmpl, Err: err}
	}

	// We need to replace <no value> with [no value] as some integrations think <no value> is invalid HTML. For example,
	// Telegram in HTML mode rejects messages with unsupported tags.
	result = strings.ReplaceAll(result, "<no value>", "[no value]")
	return result, nil
}
