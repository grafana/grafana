package prometheus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	KindPrometheus = "Prometheus"
	KindMimir      = "Mimir"
)

var (
	ErrNoBuildInfo = errors.New("no build info")
)

type BuildInfoRequest struct {
	PluginContext backend.PluginContext
}

type BuildInfoResponse struct {
	Status string                `json:"status"`
	Data   BuildInfoResponseData `json:"data"`
}

type BuildInfoResponseData struct {
	Version   string            `json:"version"`
	Revision  string            `json:"revision"`
	Branch    string            `json:"branch"`
	Features  map[string]string `json:"features"`
	BuildUser string            `json:"buildUser"`
	BuildDate string            `json:"buildDate"`
	GoVersion string            `json:"goVersion"`
}

func (s *Service) GetBuildInfo(ctx context.Context, req BuildInfoRequest) (*BuildInfoResponse, error) {
	ds, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return getBuildInfo(ctx, ds)
}

// getBuildInfo queries /api/v1/status/buildinfo
func getBuildInfo(ctx context.Context, i *instance) (*BuildInfoResponse, error) {
	resp, err := i.resource.Execute(ctx, &backend.CallResourceRequest{
		Path: "api/v1/status/buildinfo",
	})
	if err != nil {
		return nil, err
	}
	if resp.Status == http.StatusNotFound {
		return nil, ErrNoBuildInfo
	}
	if resp.Status != http.StatusOK {
		return nil, fmt.Errorf("unexpected response %d", resp.Status)
	}
	res := BuildInfoResponse{}
	if err := json.Unmarshal(resp.Body, &res); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON: %w", err)
	}
	return &res, nil
}

type HeuristicsRequest struct {
	PluginContext backend.PluginContext
}

type Heuristics struct {
	Application string   `json:"application"`
	Features    Features `json:"features"`
}

type Features struct {
	RulerApiEnabled bool `json:"rulerApiEnabled"`
}

func (s *Service) GetHeuristics(ctx context.Context, req HeuristicsRequest) (*Heuristics, error) {
	ds, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return getHeuristics(ctx, ds)
}

func getHeuristics(ctx context.Context, i *instance) (*Heuristics, error) {
	heuristics := Heuristics{
		Application: "unknown",
		Features: Features{
			RulerApiEnabled: false,
		},
	}
	buildInfo, err := getBuildInfo(ctx, i)
	if err != nil {
		logger.Warn("failed to get prometheus buildinfo", "err", err.Error())
		return nil, fmt.Errorf("failed to get buildinfo: %w", err)
	}
	if len(buildInfo.Data.Features) == 0 {
		// If there are no features then this is a Prometheus datasource
		heuristics.Application = KindPrometheus
		heuristics.Features.RulerApiEnabled = false
	} else {
		heuristics.Application = KindMimir
		heuristics.Features.RulerApiEnabled = true
	}
	return &heuristics, nil
}
