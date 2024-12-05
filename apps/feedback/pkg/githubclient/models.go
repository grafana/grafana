package githubclient

import (
	_ "embed"
)

// Types for Diagnostic data.
type DiagnosticDatasource struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Version string `json:"version"`
}

type DiagnosticPlugin struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	BuildDate string `json:"buildDate"`
}

type DiagnosticBrowser struct {
	UserAgent string `json:"userAgent"`
}

type DiagnosticUnifiedAlerting struct {
	Enabled     bool `json:"enabled"`
	MinInterval bool `json:"minInternal"`
}

type DiagnosticInstance struct {
	Edition string  `json:"edition"`
	Version string  `json:"version"`
	Slug    *string `json:"slug,omitempty"`

	FeatureToggles []string               `json:"featureToggles"`
	Datasources    []DiagnosticDatasource `json:"datasources"`
	Plugins        []DiagnosticPlugin     `json:"externallyInstalledPlugins"`

	Rbac                   bool                      `json:"rbacEnabled"`
	Saml                   bool                      `json:"samlEnabled"`
	Ldap                   bool                      `json:"ldapEnabled"`
	HasAngularSupport      bool                      `json:"hasAngularsupport"`
	AuthProxy              bool                      `json:"authProxyEnabled"`
	Expressions            bool                      `json:"expressionsEnabled"`
	PublicDashboards       bool                      `json:"publicDashboardsEnabled"`
	QueryHistory           bool                      `json:"queryHistoryEnabled"`
	RecordedQueries        bool                      `json:"recordedQueriesEnabled"`
	Reporting              bool                      `json:"reportingEnabled"`
	SecureSocksDSProxy     bool                      `json:"secureSocksDSProxyEnabled"`
	ImageRendererAvailable bool                      `json:"imageRendererAvailable"`
	UnifiedAlerting        DiagnosticUnifiedAlerting `json:"unifiedAlerting"`
}

type TemplateConfig struct {
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
}

type Diagnostic struct {
	Browser  DiagnosticBrowser  `json:"browser"`
	Instance DiagnosticInstance `json:"instance"`
}

//go:embed issue_template.md
var TemplateContent string

// Type for Template data.
type TemplateData struct {
	Datasources    []DiagnosticDatasource // Directly using diagnostic datasources.
	Plugins        []DiagnosticPlugin     // Directly using diagnostic plugins.
	FeatureToggles []string
	Configs        []TemplateConfig

	WhatHappenedQuestion string

	InstanceSlug           string
	InstanceVersion        string
	InstanceRunningVersion string

	BrowserName string
	PageURL     string

	SnapshotURL string

	CanContactReporter bool
	CanAccessInstance  bool
	UserEmail          string
}

func BuildConfigList(instanceInfo DiagnosticInstance) []TemplateConfig {
	configList := make([]TemplateConfig, 0)

	configList = append(configList, TemplateConfig{Name: "Rbac", Enabled: instanceInfo.Rbac})
	configList = append(configList, TemplateConfig{Name: "Saml", Enabled: instanceInfo.Saml})
	configList = append(configList, TemplateConfig{Name: "Ldap", Enabled: instanceInfo.Ldap})
	configList = append(configList, TemplateConfig{Name: "Angular Support", Enabled: instanceInfo.HasAngularSupport})
	configList = append(configList, TemplateConfig{Name: "Auth Proxy", Enabled: instanceInfo.AuthProxy})
	configList = append(configList, TemplateConfig{Name: "Expressions", Enabled: instanceInfo.Expressions})
	configList = append(configList, TemplateConfig{Name: "Public Dashboards", Enabled: instanceInfo.PublicDashboards})
	configList = append(configList, TemplateConfig{Name: "Query History", Enabled: instanceInfo.QueryHistory})
	configList = append(configList, TemplateConfig{Name: "Recorded Queries", Enabled: instanceInfo.RecordedQueries})
	configList = append(configList, TemplateConfig{Name: "Reporting", Enabled: instanceInfo.Reporting})
	configList = append(configList, TemplateConfig{Name: "Secure Socks DS Proxy", Enabled: instanceInfo.SecureSocksDSProxy})
	configList = append(configList, TemplateConfig{Name: "Image Renderer", Enabled: instanceInfo.ImageRendererAvailable})
	configList = append(configList, TemplateConfig{Name: "Unified Alerting", Enabled: instanceInfo.UnifiedAlerting.Enabled})
	return configList
}
