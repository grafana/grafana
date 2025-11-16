package prometheus

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/grafana/grafana/pkg/promlib"
	"github.com/grafana/grafana/pkg/promlib/converter"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/azureauth"
)

type Service struct {
	lib      *promlib.Service
	settings PrometheusSettings
}

// Add datasource config flag
type PrometheusSettings struct {
	HideWarnings bool `json:"hideWarnings"`
}

func ProvideService(httpClientProvider *sdkhttpclient.Provider) *Service {
	plog := backend.NewLoggerWith("logger", "tsdb.prometheus")
	plog.Debug("Initializing")

	// Default settings
	settings := PrometheusSettings{}

	return &Service{
		lib:      promlib.NewService(httpClientProvider, plog, extendClientOpts),
		settings: settings,
	}
}

// Standard QueryData now builds converter.Options and forwards them
func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	opts := converter.Options{
		HideWarnings: s.settings.HideWarnings,
	}
	return s.QueryDataWithOptions(ctx, req, opts)
}

// New wrapper to pass options into promlib.Service
func (s *Service) QueryDataWithOptions(ctx context.Context, req *backend.QueryDataRequest, opts converter.Options) (*backend.QueryDataResponse, error) {
	// Attach options to context so promlib/converter can read them
	ctx = context.WithValue(ctx, converter.OptionsContextKey, opts)
	return s.lib.QueryData(ctx, req)
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

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
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
	// Unmarshal PrometheusSettings from JSONData
	if len(settings.JSONData) > 0 {
		var promSettings PrometheusSettings
		if err := json.Unmarshal(settings.JSONData, &promSettings); err != nil {
			plog.Warn("failed to unmarshal prometheus settings", "error", err)
		} else {
			plog.Debug("Prometheus settings loaded", "hideWarnings", promSettings.HideWarnings)
			// ⚠️ Note: Service.settings is not directly accessible here,
			// this just logs the value. We rely on Service.QueryData for propagation.
		}
	}

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
