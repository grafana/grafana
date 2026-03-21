package prometheus

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana-prometheus-datasource/pkg/promlib"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/azureauth"
)

type Service struct {
	lib *promlib.Service
}

func ProvideService(httpClientProvider *sdkhttpclient.Provider) *Service {
	plog := backend.NewLoggerWith("logger", "tsdb.prometheus")
	plog.Debug("Initializing")
	return &Service{
		lib: promlib.NewService(httpClientProvider, plog, extendClientOpts),
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	resp, err := s.lib.QueryData(ctx, req)
	if err != nil {
		return resp, err
	}

	// Check if query warnings should be hidden based on datasource configuration
	if shouldDisableQueryWarnings(req.PluginContext.DataSourceInstanceSettings) {
		stripWarningNotices(resp)
	}

	return resp, nil
}

// shouldDisableQueryWarnings checks the datasource jsonData for the disableQueryWarnings setting.
func shouldDisableQueryWarnings(settings *backend.DataSourceInstanceSettings) bool {
	if settings == nil {
		return false
	}

	var jsonData struct {
		DisableQueryWarnings bool `json:"disableQueryWarnings"`
	}

	if err := json.Unmarshal(settings.JSONData, &jsonData); err != nil {
		return false
	}

	return jsonData.DisableQueryWarnings
}

// stripWarningNotices removes warning-severity notices from all frames in the response.
// This reduces the response size and hides non-actionable warnings from the panel UI.
func stripWarningNotices(resp *backend.QueryDataResponse) {
	if resp == nil {
		return
	}

	for refID, dr := range resp.Responses {
		changed := false
		for _, frame := range dr.Frames {
			if frame.Meta == nil || len(frame.Meta.Notices) == 0 {
				continue
			}

			filtered := make([]data.Notice, 0, len(frame.Meta.Notices))
			for _, notice := range frame.Meta.Notices {
				if notice.Severity != data.NoticeSeverityWarning {
					filtered = append(filtered, notice)
				}
			}

			if len(filtered) != len(frame.Meta.Notices) {
				frame.Meta.Notices = filtered
				changed = true
			}
		}

		if changed {
			resp.Responses[refID] = dr
		}
	}
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.lib.CallResource(ctx, req, sender)
}

func (s *Service) GetBuildInfo(ctx context.Context, req promlib.BuildInfoRequest) (*promlib.BuildInfoResponse, error) {
	return s.lib.GetBuildInfo(ctx, req)
}

func (s *Service) GetHeuristics(ctx context.Context, req promlib.HeuristicsRequest) (*promlib.Heuristics, error) {
	return s.lib.GetHeuristics(ctx, req)
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult,
	error) {
	return s.lib.CheckHealth(ctx, req)
}

func (s *Service) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	return s.lib.ValidateAdmission(ctx, req)
}

func (s *Service) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	return s.lib.MutateAdmission(ctx, req)
}
func (s *Service) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	return s.lib.ConvertObjects(ctx, req)
}

func extendClientOpts(ctx context.Context, settings backend.DataSourceInstanceSettings, clientOpts *sdkhttpclient.Options, plog log.Logger) error {
	// Set SigV4 service namespace
	if clientOpts.SigV4 != nil {
		clientOpts.SigV4.Service = "aps"
	}

	azureSettings, err := azsettings.ReadSettings(ctx)
	if err != nil {
		return fmt.Errorf("failed to read Azure settings from Grafana: %v", err)
	}

	audienceOverride := backend.GrafanaConfigFromContext(ctx).FeatureToggles().IsEnabled("prometheusAzureOverrideAudience")

	// Set Azure authentication
	if azureSettings.AzureAuthEnabled {
		err = azureauth.ConfigureAzureAuthentication(settings, azureSettings, clientOpts, audienceOverride, plog)
		if err != nil {
			return fmt.Errorf("error configuring Azure auth: %v", err)
		}
	}

	return nil
}
