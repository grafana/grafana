package docker

import (
	"github.com/grafana/grafana/pkg/build/config"
)

type Config struct {
	Bucket        string
	Edition       string
	Tag           string
	Distribution  []config.Distribution
	Archs         []config.Architecture
	DockerHubRepo string
	Security      bool
}
