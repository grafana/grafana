package phlare

import (
	"context"
	"net/http"
)

type ProfilingClient interface {
	ProfileTypes(context.Context) ([]ProfileType, error)
	LabelNames(ctx context.Context, query string, start int64, end int64) ([]string, error)
	LabelValues(ctx context.Context, query string, label string, start int64, end int64) ([]string, error)
	AllLabelsAndValues(ctx context.Context, matchers []string) (map[string][]string, error)
	GetSeries(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64, groupBy []string, step float64) ([]*Series, error)
	GetProfile(ctx context.Context, profileTypeID string, labelSelector string, start int64, end int64) (*FlameGraph, error)
}

type ProfileType struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

func getClient(backendType string, httpClient *http.Client, url string) ProfilingClient {
	if backendType == "pyroscope" {
		return NewPyroscopeClient(httpClient, url)
	}

	// We treat unset value as phlare
	return NewPhlareClient(httpClient, url)
}

type FlameGraph struct {
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
	Timestamp int64
}
