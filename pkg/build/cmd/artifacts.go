package main

import (
	"github.com/grafana/grafana/pkg/build/config"
)

const ReleaseFolder = "release"
const EnterpriseSfx = "-enterprise"
const CacheSettings = "Cache-Control:public, max-age="

type PublishConfig struct {
	config.Config

	Edition         config.Edition
	ReleaseMode     config.ReleaseMode
	GrafanaAPIKey   string
	WhatsNewURL     string
	ReleaseNotesURL string
	DryRun          bool
	TTL             string
	SimulateRelease bool
}
