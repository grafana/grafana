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

	WhatHappenedQuestion string

	InstanceSlug           string
	InstanceVersion        string
	InstanceRunningVersion string

	BrowserName string
	PageURL     string

	SnapshotURL string
}
