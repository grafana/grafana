package setting

import (
	"time"

	"github.com/grafana/grafana/pkg/infra/leaderelection"
)

func (cfg *Cfg) readIAMSettings() {
	sec := cfg.SectionWithEnvOverrides("iam.leader_election")

	cfg.IAMLeaderElection = leaderelection.Config{
		Enabled:       sec.Key("enabled").MustBool(false),
		LeaseName:     sec.Key("lease_name").MustString("iam-leader"),
		Namespace:     sec.Key("namespace").MustString(""),
		Identity:      sec.Key("identity").MustString(""),
		LeaseDuration: sec.Key("lease_duration").MustDuration(15 * time.Second),
		RenewDeadline: sec.Key("renew_deadline").MustDuration(10 * time.Second),
		RetryPeriod:   sec.Key("retry_period").MustDuration(2 * time.Second),
	}
}
