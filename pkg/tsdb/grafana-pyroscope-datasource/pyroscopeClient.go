package pyroscope

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"

	typesv1 "github.com/grafana/pyroscope/api/gen/proto/go/types/v1"

	"connectrpc.com/connect"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	querierv1 "github.com/grafana/pyroscope/api/gen/proto/go/querier/v1"
	"github.com/grafana/pyroscope/api/gen/proto/go/querier/v1/querierv1connect"
)

type ProfileType struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

type Flamebearer struct {
	Names   []string
	Levels  []*Level
	Total   int64
	MaxSelf int64
}

type Level struct {
	Values []int64
}

type Series struct {
	Labels []*LabelPair
	Points []*Point
}

type LabelPair struct {
	Name  string
	Value string
}

type Point struct {
	Value float64
	// Milliseconds unix timestamp
	Timestamp   int64
	Annotations []*typesv1.ProfileAnnotation
	Exemplars   []*Exemplar
}

type Exemplar struct {
	ProfileId string
	SpanId    string
	Value     uint64
	Timestamp int64
	Labels    []*LabelPair
}

type ProfileResponse struct {
	Flamebearer *Flamebearer
	Units       string
}

type SeriesResponse struct {
	Series []*Series
	Units  string
	Label  string
}

type HeatmapPoint struct {
	Timestamp int64
	YMin      []float64
	Counts    []int64
	Exemplars []*Exemplar
}

type HeatmapSeries struct {
	Labels []*LabelPair
	Points []*HeatmapPoint
}

type HeatmapResponse struct {
	Series []*HeatmapSeries
	Units  string
}

type PyroscopeClient struct {
	connectClient querierv1connect.QuerierServiceClient
}

func NewPyroscopeClient(httpClient *http.Client, url string) *PyroscopeClient {
	return &PyroscopeClient{
		connectClient: querierv1connect.NewQuerierServiceClient(httpClient, url),
	}
}

func (c *PyroscopeClient) ProfileTypes(ctx context.Context, start int64, end int64) ([]*ProfileType, error) {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.pyroscope.ProfileTypes")
	defer span.End()
	res, err := c.connectClient.ProfileTypes(ctx, connect.NewRequest(&querierv1.ProfileTypesRequest{
		Start: start,
		End:   end,
	}))
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, backend.DownstreamError(fmt.Errorf("received error from client while getting profile types: %w", err))
	}
	if res.Msg.ProfileTypes == nil {
		// Let's make sure we send at least empty array if we don't have any types
		return []*ProfileType{}, nil
	} else {
		pTypes := make([]*ProfileType, len(res.Msg.ProfileTypes))
		for i, pType := range res.Msg.ProfileTypes {
			pTypes[i] = &ProfileType{
				ID:    pType.ID,
				Label: pType.Name + " - " + pType.SampleType,
			}
		}
		return pTypes, nil
	}
}

func (c *PyroscopeClient) GetSeries(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64, groupBy []string, limit *int64, step float64, exemplarType typesv1.ExemplarType) (*SeriesResponse, error) {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.pyroscope.GetSeries", trace.WithAttributes(attribute.String("profileTypeID", profileTypeID), attribute.String("labelSelector", labelSelector)))
	defer span.End()
	req := connect.NewRequest(&querierv1.SelectSeriesRequest{
		ProfileTypeID: profileTypeID,
		LabelSelector: labelSelector,
		Start:         start,
		End:           end,
		Step:          step,
		GroupBy:       groupBy,
		Limit:         limit,
		ExemplarType:  exemplarType,
	})

	resp, err := c.connectClient.SelectSeries(ctx, req)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, backend.DownstreamErrorf("received error from client while getting series: %w", err)
	}

	series := make([]*Series, len(resp.Msg.Series))

	for i, s := range resp.Msg.Series {
		labels := make([]*LabelPair, len(s.Labels))
		for i, l := range s.Labels {
			labels[i] = &LabelPair{
				Name:  l.Name,
				Value: l.Value,
			}
		}

		points := make([]*Point, len(s.Points))
		for i, p := range s.Points {
			points[i] = &Point{
				Value:       p.Value,
				Timestamp:   p.Timestamp,
				Annotations: p.Annotations,
			}
			if len(p.Exemplars) > 0 {
				points[i].Exemplars = make([]*Exemplar, len(p.Exemplars))
				for j, e := range p.Exemplars {
					// Convert API labels to our LabelPair type
					exemplarLabels := make([]*LabelPair, len(e.Labels))
					for k, l := range e.Labels {
						exemplarLabels[k] = &LabelPair{
							Name:  l.Name,
							Value: l.Value,
						}
					}
					points[i].Exemplars[j] = &Exemplar{
						ProfileId: e.ProfileId,
						SpanId:    e.SpanId,
						Value:     e.Value,
						Timestamp: e.Timestamp,
						Labels:    exemplarLabels,
					}
				}
			}
		}

		series[i] = &Series{
			Labels: labels,
			Points: points,
		}
	}

	parts := strings.Split(profileTypeID, ":")

	return &SeriesResponse{
		Series: series,
		Units:  getUnits(profileTypeID),
		Label:  parts[1],
	}, nil
}

func (c *PyroscopeClient) GetHeatmap(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64, groupBy []string, step float64, queryType querierv1.HeatmapQueryType, limit *int64, includeExemplars bool) (*HeatmapResponse, error) {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.pyroscope.GetHeatmap", trace.WithAttributes(attribute.String("profileTypeID", profileTypeID), attribute.String("labelSelector", labelSelector)))
	defer span.End()

	// Determine exemplar type based on includeExemplars flag and query type
	exemplarType := typesv1.ExemplarType_EXEMPLAR_TYPE_NONE
	if includeExemplars {
		switch queryType {
		case querierv1.HeatmapQueryType_HEATMAP_QUERY_TYPE_SPAN:
			exemplarType = typesv1.ExemplarType_EXEMPLAR_TYPE_SPAN
		case querierv1.HeatmapQueryType_HEATMAP_QUERY_TYPE_INDIVIDUAL:
			exemplarType = typesv1.ExemplarType_EXEMPLAR_TYPE_INDIVIDUAL
		}
	}

	req := connect.NewRequest(&querierv1.SelectHeatmapRequest{
		ProfileTypeID: profileTypeID,
		LabelSelector: labelSelector,
		Start:         start,
		End:           end,
		Step:          step,
		GroupBy:       groupBy,
		QueryType:     queryType,
		Limit:         limit,
		ExemplarType:  exemplarType,
	})

	resp, err := c.connectClient.SelectHeatmap(ctx, req)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, backend.DownstreamErrorf("received error from client while getting heatmap: %w", err)
	}

	series := make([]*HeatmapSeries, len(resp.Msg.Series))
	for i, s := range resp.Msg.Series {
		labels := make([]*LabelPair, len(s.Labels))
		for j, l := range s.Labels {
			labels[j] = &LabelPair{
				Name:  l.Name,
				Value: l.Value,
			}
		}

		points := make([]*HeatmapPoint, len(s.Slots))
		for j, slot := range s.Slots {
			// Convert []int32 to []int64
			counts := make([]int64, len(slot.Counts))
			for k, c := range slot.Counts {
				counts[k] = int64(c)
			}

			// Process exemplars if present
			exemplars := make([]*Exemplar, len(slot.Exemplars))
			for k, e := range slot.Exemplars {
				// Convert API labels to our LabelPair type
				exemplarLabels := make([]*LabelPair, len(e.Labels))
				for i, l := range e.Labels {
					exemplarLabels[i] = &LabelPair{
						Name:  l.Name,
						Value: l.Value,
					}
				}
				exemplars[k] = &Exemplar{
					ProfileId: e.ProfileId,
					SpanId:    e.SpanId,
					Value:     e.Value,
					Timestamp: e.Timestamp,
					Labels:    exemplarLabels,
				}
			}

			points[j] = &HeatmapPoint{
				Timestamp: slot.Timestamp,
				YMin:      slot.YMin,
				Counts:    counts,
				Exemplars: exemplars,
			}
		}

		series[i] = &HeatmapSeries{
			Labels: labels,
			Points: points,
		}
	}

	return &HeatmapResponse{
		Series: series,
		Units:  getUnits(profileTypeID),
	}, nil
}

func (c *PyroscopeClient) GetProfile(ctx context.Context, profileTypeID, labelSelector string, start, end int64, maxNodes *int64) (*ProfileResponse, error) {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.pyroscope.GetProfile", trace.WithAttributes(attribute.String("profileTypeID", profileTypeID), attribute.String("labelSelector", labelSelector)))
	defer span.End()
	req := &connect.Request[querierv1.SelectMergeStacktracesRequest]{
		Msg: &querierv1.SelectMergeStacktracesRequest{
			ProfileTypeID: profileTypeID,
			LabelSelector: labelSelector,
			Start:         start,
			End:           end,
			MaxNodes:      maxNodes,
		},
	}

	resp, err := c.connectClient.SelectMergeStacktraces(ctx, req)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, backend.DownstreamError(fmt.Errorf("received error from client while getting profile: %w", err))
	}

	if resp.Msg.Flamegraph == nil {
		// Not an error, can happen when querying data oout of range.
		return nil, nil
	}

	return profileQuery(resp.Msg.Flamegraph, profileTypeID)
}

func (c *PyroscopeClient) GetSpanProfile(ctx context.Context, profileTypeID, labelSelector string, spanSelector []string, start, end int64, maxNodes *int64) (*ProfileResponse, error) {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.pyroscope.GetSpanProfile", trace.WithAttributes(attribute.String("profileTypeID", profileTypeID), attribute.String("labelSelector", labelSelector), attribute.String("spanSelector", strings.Join(spanSelector, ","))))
	defer span.End()
	req := &connect.Request[querierv1.SelectMergeSpanProfileRequest]{
		Msg: &querierv1.SelectMergeSpanProfileRequest{
			ProfileTypeID: profileTypeID,
			LabelSelector: labelSelector,
			SpanSelector:  spanSelector,
			Start:         start,
			End:           end,
			MaxNodes:      maxNodes,
		},
	}

	resp, err := c.connectClient.SelectMergeSpanProfile(ctx, req)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, backend.DownstreamError(fmt.Errorf("received error from client while getting span profile: %w", err))
	}

	if resp.Msg.Flamegraph == nil {
		// Not an error, can happen when querying data out of range.
		return nil, nil
	}

	return profileQuery(resp.Msg.Flamegraph, profileTypeID)
}

func profileQuery(flamegraph *querierv1.FlameGraph, profileTypeID string) (*ProfileResponse, error) {
	levels := make([]*Level, len(flamegraph.Levels))
	for i, level := range flamegraph.Levels {
		levels[i] = &Level{
			Values: level.Values,
		}
	}

	return &ProfileResponse{
		Flamebearer: &Flamebearer{
			Names:   flamegraph.Names,
			Levels:  levels,
			Total:   flamegraph.Total,
			MaxSelf: flamegraph.MaxSelf,
		},
		Units: getUnits(profileTypeID),
	}, nil
}

func getUnits(profileTypeID string) string {
	parts := strings.Split(profileTypeID, ":")
	unit := parts[2]
	if unit == "nanoseconds" {
		return "ns"
	}
	if unit == "count" {
		return "short"
	}
	return unit
}

func (c *PyroscopeClient) LabelNames(ctx context.Context, labelSelector string, start int64, end int64) ([]string, error) {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.pyroscope.LabelNames")
	defer span.End()
	resp, err := c.connectClient.LabelNames(ctx, connect.NewRequest(&typesv1.LabelNamesRequest{
		Matchers: []string{labelSelector},
		Start:    start,
		End:      end,
	}))
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, backend.DownstreamError(fmt.Errorf("error sending LabelNames request %v", err))
	}

	if resp.Msg.Names == nil {
		return []string{}, nil
	}

	var filtered []string
	for _, label := range resp.Msg.Names {
		if !isPrivateLabel(label) {
			filtered = append(filtered, label)
		}
	}

	return filtered, nil
}

func (c *PyroscopeClient) LabelValues(ctx context.Context, label string, labelSelector string, start int64, end int64) ([]string, error) {
	ctx, span := tracing.DefaultTracer().Start(ctx, "datasource.pyroscope.LabelValues")
	defer span.End()
	resp, err := c.connectClient.LabelValues(ctx, connect.NewRequest(&typesv1.LabelValuesRequest{
		Name:     label,
		Matchers: []string{labelSelector},
		Start:    start,
		End:      end,
	}))
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, backend.DownstreamError(fmt.Errorf("received error from client while getting label values: %w", err))
	}
	if resp.Msg.Names == nil {
		return []string{}, nil
	}
	return resp.Msg.Names, nil
}

func isPrivateLabel(label string) bool {
	return strings.HasPrefix(label, "__")
}
