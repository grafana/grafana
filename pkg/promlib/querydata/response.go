package querydata

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/promlib/converter"
	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/promlib/querydata/exemplar"
	"github.com/grafana/grafana/pkg/promlib/utils"
)

func (s *QueryData) parseResponse(ctx context.Context, q *models.Query, res *http.Response) backend.DataResponse {
	defer func() {
		if err := res.Body.Close(); err != nil {
			s.log.FromContext(ctx).Error("Failed to close response body", "err", err)
		}
	}()

	ctx, endSpan := utils.StartTrace(ctx, s.tracer, "datasource.prometheus.parseResponse")
	defer endSpan()

	statusCode := res.StatusCode

	switch {
	// Status codes that Prometheus might return
	// so we want to parse the response
	// https://prometheus.io/docs/prometheus/latest/querying/api/#format-overview
	case statusCode >= http.StatusOK && statusCode < http.StatusMultipleChoices,
		statusCode == http.StatusBadRequest,
		statusCode == http.StatusUnprocessableEntity,
		statusCode == http.StatusServiceUnavailable:

		iter := jsoniter.Parse(jsoniter.ConfigDefault, res.Body, 1024)
		r := converter.ReadPrometheusStyleResult(iter, converter.Options{})
		r.Status = backend.Status(res.StatusCode)

		// Add frame to attach metadata
		if len(r.Frames) == 0 && !q.ExemplarQuery {
			r.Frames = append(r.Frames, data.NewFrame(""))
		}

		// The ExecutedQueryString can be viewed in QueryInspector in UI
		for i, frame := range r.Frames {
			addMetadataToMultiFrame(q, frame)
			if i == 0 {
				frame.Meta.ExecutedQueryString = executedQueryString(q)
				if frame.Meta.Custom == nil {
					frame.Meta.Custom = make(map[string]any)
				}
				if custom, ok := frame.Meta.Custom.(map[string]any); ok {
					// This is required for incremental querying feature
					// Knowing the calculated minStep is required for merging and caching the frames on frontend side
					custom["calculatedMinStep"] = q.Step.Milliseconds()
				}
			}
		}

		if r.Error == nil {
			r = s.processExemplars(ctx, q, r)
		}

		return r
	default:
		// Unknown status code. We don't want to parse the response.
		const maxBodySize = 1024
		lr := io.LimitReader(res.Body, maxBodySize)
		tb, _ := io.ReadAll(lr)

		s.log.FromContext(ctx).Error("Unexpected response received", "status", statusCode, "body", tb)

		errResp := backend.DataResponse{
			Error:       fmt.Errorf("unexpected response with status code %d: %s", statusCode, tb),
			ErrorSource: backend.ErrorSourceFromHTTPStatus(statusCode),
		}

		f := data.NewFrame("")
		addMetadataToMultiFrame(q, f)
		f.Meta.ExecutedQueryString = executedQueryString(q)
		errResp.Frames = append(errResp.Frames, f)

		return errResp
	}
}

func (s *QueryData) processExemplars(ctx context.Context, q *models.Query, dr backend.DataResponse) backend.DataResponse {
	_, endSpan := utils.StartTrace(ctx, s.tracer, "datasource.prometheus.processExemplars")
	defer endSpan()
	sampler := s.exemplarSampler()
	labelTracker := exemplar.NewLabelTracker()

	// we are moving from a multi-frame response returned
	// by the converter to a single exemplar frame,
	// so we need to build a new frame array with the
	// old exemplar frames filtered out
	framer := exemplar.NewFramer(sampler, labelTracker)

	for _, frame := range dr.Frames {
		// we don't need to process non-exemplar frames
		// so they can be added to the response
		if !isExemplarFrame(frame) {
			framer.AddFrame(frame)
			continue
		}

		// copy the current exemplar frame metadata
		framer.SetMeta(frame.Meta)
		framer.SetRefID(frame.RefID)

		step := time.Duration(frame.Fields[0].Config.Interval) * time.Millisecond
		sampler.SetStep(step)

		seriesLabels := getSeriesLabels(frame)
		labelTracker.Add(seriesLabels)
		labelTracker.AddFields(frame.Fields[2:])
		for rowIdx := 0; rowIdx < frame.Fields[0].Len(); rowIdx++ {
			ts := frame.CopyAt(0, rowIdx).(time.Time)
			val := frame.CopyAt(1, rowIdx).(float64)
			ex := models.Exemplar{
				RowIdx:       rowIdx,
				Fields:       frame.Fields[2:],
				Value:        val,
				Timestamp:    ts,
				SeriesLabels: seriesLabels,
			}
			sampler.Add(ex)
		}
	}

	frames, err := framer.Frames()

	return backend.DataResponse{
		Frames: frames,
		Error:  err,
	}
}

func addMetadataToMultiFrame(q *models.Query, frame *data.Frame) {
	if frame.Meta == nil {
		frame.Meta = &data.FrameMeta{}
	}
	if len(frame.Fields) < 2 {
		return
	}
	frame.Fields[0].Config = &data.FieldConfig{Interval: float64(q.Step.Milliseconds())}

	customName := getName(q, frame.Fields[1])
	if customName != "" {
		frame.Fields[1].Config = &data.FieldConfig{DisplayNameFromDS: customName}
	}

	// For heatmap-cells type we don't want to set field name
	// prometheus native histograms have their own field name structure
	if frame.Meta.Type == "heatmap-cells" {
		return
	}

	valueField := frame.Fields[1]
	if n, ok := valueField.Labels["__name__"]; ok {
		valueField.Name = n
	}
}

// this is based on the logic from the String() function in github.com/prometheus/common/model.go
func metricNameFromLabels(f *data.Field) string {
	labels := f.Labels
	metricName, hasName := labels["__name__"]
	numLabels := len(labels) - 1
	if !hasName {
		numLabels = len(labels)
	}
	labelStrings := make([]string, 0, numLabels)
	for label, value := range labels {
		if label != "__name__" {
			labelStrings = append(labelStrings, fmt.Sprintf("%s=%q", label, value))
		}
	}

	switch numLabels {
	case 0:
		if hasName {
			return metricName
		}
		return "{}"
	default:
		sort.Strings(labelStrings)
		return fmt.Sprintf("%s{%s}", metricName, strings.Join(labelStrings, ", "))
	}
}

func executedQueryString(q *models.Query) string {
	return "Expr: " + q.Expr + "\n" + "Step: " + q.Step.String()
}

func getName(q *models.Query, field *data.Field) string {
	labels := field.Labels
	legend := metricNameFromLabels(field)

	if q.LegendFormat == legendFormatAuto {
		if len(labels) > 0 {
			legend = ""
		}
	} else if q.LegendFormat != "" {
		result := legendFormatRegexp.ReplaceAllFunc([]byte(q.LegendFormat), func(in []byte) []byte {
			labelName := strings.Replace(string(in), "{{", "", 1)
			labelName = strings.Replace(labelName, "}}", "", 1)
			labelName = strings.TrimSpace(labelName)
			if val, exists := labels[labelName]; exists {
				return []byte(val)
			}
			return []byte{}
		})
		legend = string(result)
	}

	// If legend is empty brackets, use query expression
	if legend == "{}" {
		return q.Expr
	}

	return legend
}

func isExemplarFrame(frame *data.Frame) bool {
	rt := models.ResultTypeFromFrame(frame)
	return rt == models.ResultTypeExemplar
}

func getSeriesLabels(frame *data.Frame) data.Labels {
	// series labels are stored on the value field (index 1)
	return frame.Fields[1].Labels.Copy()
}
