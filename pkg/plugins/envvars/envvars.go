package envvars

import (
	"context"
	"os"

	"github.com/grafana/grafana/pkg/plugins"
)

// permittedHostEnvVarNames is the list of environment variables that can be passed from Grafana's process to the
// plugin's process
var permittedHostEnvVarNames = []string{
	// Env vars used by net/http (Go stdlib) for http/https proxy
	// https://github.com/golang/net/blob/fbaf41277f28102c36926d1368dafbe2b54b4c1d/http/httpproxy/proxy.go#L91-L93
	"HTTP_PROXY",
	"http_proxy",
	"HTTPS_PROXY",
	"https_proxy",
	"NO_PROXY",
	"no_proxy",
}

type Provider interface {
	PluginEnvVars(ctx context.Context, p *plugins.Plugin) []string
}

type Service struct{}

func DefaultProvider() *Service {
	return &Service{}
}

func (s *Service) PluginEnvVars(_ context.Context, _ *plugins.Plugin) []string {
	return PermittedHostEnvVars()
}

// PermittedHostEnvVars returns the variables that can be passed from Grafana's process
// (current process, also known as: "host") to the plugin process.
// A string in format "k=v" is returned for each variable in PermittedHostEnvVarNames, if it's set.
func PermittedHostEnvVars() []string {
	var r []string
	for _, envVarName := range PermittedHostEnvVarNames() {
		if envVarValue, ok := os.LookupEnv(envVarName); ok {
			r = append(r, envVarName+"="+envVarValue)
		}
	}
	return r
}

func PermittedHostEnvVarNames() []string {
	return permittedHostEnvVarNames
}
