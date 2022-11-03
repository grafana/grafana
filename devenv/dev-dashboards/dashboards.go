package dev_dashboards

import "embed"

// generate gen.libsonnet
//go:generate go run gen.go

//go:embed *.json */*.json
var DevDashboardFS embed.FS
