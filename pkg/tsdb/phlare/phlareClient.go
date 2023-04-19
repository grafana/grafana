package phlare

import (
	"context"
	"net/http"

	"github.com/bufbuild/connect-go"
	querierv1 "github.com/grafana/phlare/api/gen/proto/go/querier/v1"
	"github.com/grafana/phlare/api/gen/proto/go/querier/v1/querierv1connect"
)

type PhlareClient struct {
	connectClient querierv1connect.QuerierServiceClient
}

func NewPhlareClient(httpClient *http.Client, url string) *PhlareClient {
	return &PhlareClient{
		connectClient: querierv1connect.NewQuerierServiceClient(httpClient, url),
	}
}

func (c *PhlareClient) ProfileTypes(ctx context.Context) ([]ProfileType, error) {
	res, err := c.connectClient.ProfileTypes(ctx, connect.NewRequest(&querierv1.ProfileTypesRequest{}))
	if err != nil {
		return nil, err
	}
	if res.Msg.ProfileTypes == nil {
		// Let's make sure we send at least empty array if we don't have any types
		return []ProfileType{}, nil
	} else {
		pTypes := make([]ProfileType, len(res.Msg.ProfileTypes))
		for i, pType := range res.Msg.ProfileTypes {
			pTypes[i] = ProfileType{
				ID:    pType.ID,
				Label: pType.Name + " - " + pType.SampleType,
			}

		}
		return pTypes, nil
	}
}

func (c *PhlareClient) GetSeries(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64, groupBy []string, step float64) ([]*Series, error) {
	req := connect.NewRequest(&querierv1.SelectSeriesRequest{
		ProfileTypeID: profileTypeID,
		LabelSelector: labelSelector,
		Start:         start,
		End:           end,
		Step:          step,
		GroupBy:       groupBy,
	})

	resp, err := c.connectClient.SelectSeries(ctx, req)
	if err != nil {
		return nil, err
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
				Value:     p.Value,
				Timestamp: p.Timestamp,
			}
		}

		series[i] = &Series{
			Labels: labels,
			Points: points,
		}
	}

	return series, nil
}

func (c *PhlareClient) GetProfile(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64) (*FlameGraph, error) {
	req := &connect.Request[querierv1.SelectMergeStacktracesRequest]{
		Msg: &querierv1.SelectMergeStacktracesRequest{
			ProfileTypeID: profileTypeID,
			LabelSelector: labelSelector,
			Start:         start,
			End:           end,
		},
	}

	resp, err := c.connectClient.SelectMergeStacktraces(ctx, req)
	if err != nil {
		return nil, err
	}

	levels := make([]*Level, len(resp.Msg.Flamegraph.Levels))
	for i, level := range resp.Msg.Flamegraph.Levels {
		levels[i] = &Level{
			Values: level.Values,
		}
	}

	return &FlameGraph{
		Names:   resp.Msg.Flamegraph.Names,
		Levels:  levels,
		Total:   resp.Msg.Flamegraph.Total,
		MaxSelf: resp.Msg.Flamegraph.MaxSelf,
	}, nil
}

func (c *PhlareClient) LabelNames(ctx context.Context, query string, start int64, end int64) ([]string, error) {
	resp, err := c.connectClient.LabelNames(ctx, connect.NewRequest(&querierv1.LabelNamesRequest{}))
	if err != nil {
		return nil, err
	}

	return resp.Msg.Names, nil
}

func (c *PhlareClient) LabelValues(ctx context.Context, query string, label string, start int64, end int64) ([]string, error) {
	// Phlare don't have a good endpoint for this so front end should use the AllLabelsAndValues API to get all the
	// values at once
	return []string{}, nil
}

func (c *PhlareClient) AllLabelsAndValues(ctx context.Context, matchers []string) (map[string][]string, error) {
	res, err := c.connectClient.Series(ctx, connect.NewRequest(&querierv1.SeriesRequest{Matchers: matchers}))
	if err != nil {
		return nil, err
	}

	result := make(map[string][]string)

	for _, val := range res.Msg.LabelsSet {
		withoutPrivate := withoutPrivateLabels(val.Labels)

		for _, label := range withoutPrivate {
			if _, ok := result[label.Name]; ok {
				result[label.Name] = append(result[label.Name], label.Value)
			} else {
				result[label.Name] = []string{label.Value}
			}
		}
	}
	return result, nil
}
