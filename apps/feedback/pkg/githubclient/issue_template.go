package main

import (
	"bytes"
	_ "embed"
	"fmt"
	"text/template"
)

//go:embed issue_template.md
var templateContent string

type Datasource struct {
	Name    string
	Type    string
	Version string
}

type Plugin struct {
	Name      string
	Version   string
	BuildDate string
}

type FeatureToggle struct {
	Name  string
	Value string
}

type TemplateData struct {
	Datasources    []Datasource
	Plugins        []Plugin
	FeatureToggles []FeatureToggle

	WhatHappenedQuestion string
	ReproduceQuestion    string

	InstanceSlug           string
	InstanceVersion        string
	InstanceRunningVersion string

	BrowserName    string
	BrowserVersion string
	PageURL        string

	SnapshotURL string
}

func main() {
	// Example data for Datasources table
	tableDatasources := []Datasource{
		{"Prometheus", "prometheus", ""},
		{"ClickHouse", "grafana-clickhouse-datasource", "4.5.1"},
	}

	// Example data for Plugins table
	tablePlugins := []Plugin{
		{"ClickHouse", "4.5.1", "2024-11-27"},
		{"Explore Logs", "1.0.4", "2024-11-21"},
	}

	// Example data for Feature Toggles table
	tableFeatureToggles := []FeatureToggle{
		{"accessActionSets", "False"},
		{"accessControlOnCall", "True"},
	}

	whatHappenedQuestion := "I clicked on the 'Save' button and the page crashed."
	reproduceQuestion := "Click on the 'Save' button and the page will crash."
	instanceSlug := "danasintance"
	instanceVersion := "fast"
	instanceRunningVersion := "11.4.0-7982"

	browserName := "Chrome"
	browserVersion := "99.0.4844.51"
	pageURL := "/admin/migrate-to-cloud"

	snapshotURL := "https://github.com/grafana/hackathon-feedback-button/blob/main/images/6d280ec6-8565-4b46-8df8-f73321df024e.png"

	// Combine data into TemplateData struct
	data := TemplateData{
		Datasources:    tableDatasources,
		Plugins:        tablePlugins,
		FeatureToggles: tableFeatureToggles,

		WhatHappenedQuestion:   whatHappenedQuestion,
		ReproduceQuestion:      reproduceQuestion,
		InstanceSlug:           instanceSlug,
		InstanceVersion:        instanceVersion,
		InstanceRunningVersion: instanceRunningVersion,
		BrowserName:            browserName,
		BrowserVersion:         browserVersion,
		PageURL:                pageURL,
		SnapshotURL:            snapshotURL,
	}

	// Parse the embedded template
	tmpl, err := template.New("report").Parse(templateContent)
	if err != nil {
		panic(err)
	}

	// Render the template with data
	var result bytes.Buffer
	if err := tmpl.Execute(&result, data); err != nil {
		panic(err)
	}

	// Output the result
	fmt.Println(result.String())
}
