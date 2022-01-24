package featuremgmt

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/secrets"
)

var (
	FLAG_database_metrics = "database_metrics"
	FLAG_live_config      = "live-config"
	FLAG_recordedQueries  = "recordedQueries"

	// Register each toggle here
	standardFeatureFlags = []models.FeatureFlag{
		{
			Name:            FLAG_recordedQueries,
			Description:     "Supports saving queries that can be scraped by prometheus",
			State:           models.FeatureStateBeta,
			RequiresLicense: true,
		},
		{
			Name:            "teamsync",
			Description:     "Team sync lets you set up synchronization between your auth providers teams and teams in Grafana",
			State:           models.FeatureStateStable,
			DocsURL:         "https://grafana.com/docs/grafana/latest/enterprise/team-sync/",
			RequiresLicense: true,
		},
		{
			Name:            "ldapsync",
			Description:     "Enhanced LDAP integration",
			State:           models.FeatureStateStable,
			DocsURL:         "https://grafana.com/docs/grafana/latest/enterprise/enhanced_ldap/",
			RequiresLicense: true,
		},
		{
			Name:            "caching",
			Description:     "Temporarily store data source query results.",
			State:           models.FeatureStateStable,
			DocsURL:         "https://grafana.com/docs/grafana/latest/enterprise/query-caching/",
			RequiresLicense: true,
		},
		{
			Name:            "dspermissions",
			Description:     "Data source permissions",
			State:           models.FeatureStateStable,
			DocsURL:         "https://grafana.com/docs/grafana/latest/enterprise/datasource_permissions/",
			RequiresLicense: true,
		},
		{
			Name:            "analytics",
			Description:     "Analytics",
			State:           models.FeatureStateStable,
			RequiresLicense: true,
		},
		{
			Name:            "enterprise.plugins",
			Description:     "Enterprise plugins",
			State:           models.FeatureStateStable,
			DocsURL:         "https://grafana.com/grafana/plugins/?enterprise=1",
			RequiresLicense: true,
		},
		{
			Name:        "trimDefaults",
			Description: "Use cue schema to remove values that will be applied automatically",
			State:       models.FeatureStateBeta,
		},
		{
			Name:        secrets.EnvelopeEncryptionFeatureToggle,
			Description: "encrypt secrets",
			State:       models.FeatureStateBeta,
		},

		{
			Name:  "httpclientprovider_azure_auth",
			State: models.FeatureStateBeta,
		},
		{
			Name:            "service-accounts",
			Description:     "support service accounts",
			State:           models.FeatureStateBeta,
			RequiresLicense: true,
		},

		{
			Name:        FLAG_database_metrics,
			Description: "Add prometheus metrics for database tables",
			State:       models.FeatureStateStable,
		},
		{
			Name:        "dashboardPreviews",
			Description: "Create and show thumbnails for dashboard search results",
			State:       models.FeatureStateAlpha,
		},
		{
			Name:        FLAG_live_config,
			Description: "Save grafana live configuration in SQL tables",
			State:       models.FeatureStateAlpha,
		},
		{
			Name:        "live-pipeline",
			Description: "enable a generic live processing pipeline",
			State:       models.FeatureStateAlpha,
		},
		{
			Name:         "live-service-web-worker",
			Description:  "This will use a webworker thread to processes events rather than the main thread",
			State:        models.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "queryOverLive",
			Description:  "Use grafana live websocket to execute backend queries",
			State:        models.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "tempoSearch",
			Description:  "Enable searching in tempo datasources",
			State:        models.FeatureStateBeta,
			FrontendOnly: true,
		},
		{
			Name:        "tempoBackendSearch",
			Description: "Use backend for tempo search",
			State:       models.FeatureStateBeta,
		},
		{
			Name:         "tempoServiceGraph",
			Description:  "show service",
			State:        models.FeatureStateBeta,
			FrontendOnly: true,
		},
		{
			Name:         "fullRangeLogsVolume",
			Description:  "Show full range logs volume in expore",
			State:        models.FeatureStateBeta,
			FrontendOnly: true,
		},
		{
			Name:            "accesscontrol",
			Description:     "Support robust access control",
			State:           models.FeatureStateBeta,
			RequiresLicense: true,
		},
		{
			Name:        "prometheus_azure_auth",
			Description: "Use azure authentication for prometheus datasource",
			State:       models.FeatureStateBeta,
		},
		{
			Name:        "newNavigation",
			Description: "Try the next gen naviation model",
			State:       models.FeatureStateAlpha,
		},
		{
			Name:            "showFeatureFlagsInUI",
			Description:     "Show feature flags in the settings UI",
			State:           models.FeatureStateAlpha,
			RequiresDevMode: true,
		},
		{
			Name:  "disable_http_request_histogram",
			State: models.FeatureStateAlpha,
		},
	}
)
