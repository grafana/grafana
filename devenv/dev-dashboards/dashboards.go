package dev_dashboards

import "embed"

//go:embed *.json */*.json
var DevDashboardFS embed.FS
