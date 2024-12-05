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

type DiagnosticInstance struct {
	Edition string `json:"edition"`
	Version string `json:"version"`

	FeatureToggles []string               `json:"featureToggles"`
	Datasources    []DiagnosticDatasource `json:"datasources"`
	Plugins        []DiagnosticPlugin     `json:"externallyInstalledPlugins"`
}

type TemplateConfig struct {
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
}

type Diagnostic struct {
	Browser  DiagnosticBrowser  `json:"browser"`
	Instance DiagnosticInstance `json:"instance"`

	Rbac                   bool `json:"rbacEnabled"`
	Saml                   bool `json:"samlEnabled"`
	Ldap                   bool `json:"ldapEnabled"`
	HasAngularSupport      bool `json:"hasAngularsupport"`
	AuthProxy              bool `json:"authProxyEnabled"`
	Expressions            bool `json:"expressionsEnabled"`
	PublicDashboards       bool `json:"publicDashboardsEnabled"`
	QueryHistory           bool `json:"queryHistoryEnabled"`
	RecordedQueries        bool `json:"recordedQueriesEnabled"`
	Reporting              bool `json:"reportingEnabled"`
	SecureSocksDSProxy     bool `json:"secureSocksDSProxyEnabled"`
	ImageRendererAvailable bool `json:"imageRendererAvailable"`
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
}

func BuildConfigList(diagnostic Diagnostic) []TemplateConfig {
	configList := make([]TemplateConfig, 0)

	configList = append(configList, TemplateConfig{Name: "Rbac", Enabled: diagnostic.Rbac})
	configList = append(configList, TemplateConfig{Name: "Saml", Enabled: diagnostic.Saml})
	configList = append(configList, TemplateConfig{Name: "Ldap", Enabled: diagnostic.Ldap})
	configList = append(configList, TemplateConfig{Name: "Angular Support", Enabled: diagnostic.HasAngularSupport})
	configList = append(configList, TemplateConfig{Name: "Auth Proxy", Enabled: diagnostic.AuthProxy})
	configList = append(configList, TemplateConfig{Name: "Expressions", Enabled: diagnostic.Expressions})
	configList = append(configList, TemplateConfig{Name: "Public Dashboards", Enabled: diagnostic.PublicDashboards})
	configList = append(configList, TemplateConfig{Name: "Query History", Enabled: diagnostic.QueryHistory})
	configList = append(configList, TemplateConfig{Name: "Recorded Queries", Enabled: diagnostic.RecordedQueries})
	configList = append(configList, TemplateConfig{Name: "Reporting", Enabled: diagnostic.Reporting})
	configList = append(configList, TemplateConfig{Name: "Secure Socks DS Proxy", Enabled: diagnostic.SecureSocksDSProxy})
	configList = append(configList, TemplateConfig{Name: "Image Renderer", Enabled: diagnostic.ImageRendererAvailable})

	return configList
}
