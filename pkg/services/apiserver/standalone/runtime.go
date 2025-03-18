package standalone

import (
	"fmt"
	"strings"
)

type RuntimeConfig struct {
	Group   string
	Version string
	Enabled bool
}

func (a RuntimeConfig) String() string {
	return fmt.Sprintf("%s/%s=%v", a.Group, a.Version, a.Enabled)
}

// Supported options are:
//
//	<group>/<version>=true|false for a specific API group and version (e.g. dashboard.grafana.app/v0alpha1=true)
//	api/all=true|false controls all API versions
//	api/ga=true|false controls all API versions of the form v[0-9]+
//	api/beta=true|false controls all API versions of the form v[0-9]+beta[0-9]+
//	api/alpha=true|false controls all API versions of the form v[0-9]+alpha[0-9]+`)
//
// See: https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/
func ReadRuntimeConfig(cfg string) ([]RuntimeConfig, error) {
	if cfg == "" {
		return nil, fmt.Errorf("missing --runtime-config={apiservers}")
	}
	parts := strings.Split(cfg, ",")
	apis := make([]RuntimeConfig, len(parts))
	for i, part := range parts {
		idx0 := strings.Index(part, "/")
		idx1 := strings.LastIndex(part, "=")
		if idx1 < idx0 || idx0 < 0 {
			return nil, fmt.Errorf("expected values in the form: group/version=true")
		}
		apis[i] = RuntimeConfig{
			Group:   part[:idx0],
			Version: part[idx0+1 : idx1],
			Enabled: part[idx1+1:] == "true",
		}
	}
	return apis, nil
}
