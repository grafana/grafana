package setting

import (
	"time"
)

type CloudMigrationSettings struct {
	IsTarget                  bool
	GcomAPIToken              string
	FetchInstanceTimeout      time.Duration
	CreateAccessPolicyTimeout time.Duration
	FetchAccessPolicyTimeout  time.Duration
	DeleteAccessPolicyTimeout time.Duration
	CreateTokenTimeout        time.Duration
}

func (cfg *Cfg) readCloudMigrationSettings() {
	cloudMigration := cfg.Raw.Section("cloud_migration")
	cfg.CloudMigration.IsTarget = cloudMigration.Key("is_target").MustBool(false)
	cfg.CloudMigration.GcomAPIToken = cloudMigration.Key("gcom_api_token").MustString("")
	cfg.CloudMigration.FetchInstanceTimeout = cloudMigration.Key("fetch_instance_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.CreateAccessPolicyTimeout = cloudMigration.Key("create_access_policy_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.FetchAccessPolicyTimeout = cloudMigration.Key("fetch_access_policy_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.DeleteAccessPolicyTimeout = cloudMigration.Key("delete_access_policy_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.CreateTokenTimeout = cloudMigration.Key("create_token_timeout").MustDuration(5 * time.Second)
}
