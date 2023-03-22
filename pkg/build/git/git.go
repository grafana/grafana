package git

import (
	"fmt"
	"regexp"
)

const (
	MainBranch                 = "main"
	HomeDir                    = "."
	RepoOwner                  = "grafana"
	OSSRepo                    = "grafana"
	EnterpriseRepo             = "grafana-enterprise"
	EnterpriseCheckName        = "Grafana Enterprise"
	EnterpriseCheckDescription = "Downstream tests to ensure that your changes are compatible with Grafana Enterprise"
)

func PRCheckRegexp() *regexp.Regexp {
	reBranch, err := regexp.Compile(`^prc-([0-9]+)-([A-Za-z0-9]+)\/(.+)$`)
	if err != nil {
		panic(fmt.Sprintf("Failed to compile regexp: %s", err))
	}

	return reBranch
}
