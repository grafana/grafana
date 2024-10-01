package setting

import (
	"path/filepath"
	"time"
)

type CloudMigrationSettings struct {
	IsTarget                    bool
	GcomAPIToken                string
	SnapshotFolder              string
	GMSDomain                   string
	GMSStartSnapshotTimeout     time.Duration
	GMSGetSnapshotStatusTimeout time.Duration
	GMSCreateUploadUrlTimeout   time.Duration
	GMSValidateKeyTimeout       time.Duration
	GMSReportEventTimeout       time.Duration
	FetchInstanceTimeout        time.Duration
	CreateAccessPolicyTimeout   time.Duration
	FetchAccessPolicyTimeout    time.Duration
	DeleteAccessPolicyTimeout   time.Duration
	ListTokensTimeout           time.Duration
	CreateTokenTimeout          time.Duration
	DeleteTokenTimeout          time.Duration
	TokenExpiresAfter           time.Duration
	FeedbackURL                 string
	FrontendPollInterval        time.Duration

	IsDeveloperMode bool
}

func (cfg *Cfg) readCloudMigrationSettings() {
	cloudMigration := cfg.Raw.Section("cloud_migration")
	cfg.CloudMigration.IsTarget = cloudMigration.Key("is_target").MustBool(false)
	cfg.CloudMigration.GcomAPIToken = cloudMigration.Key("gcom_api_token").MustString("")
	cfg.CloudMigration.SnapshotFolder = cloudMigration.Key("snapshot_folder").MustString("")
	cfg.CloudMigration.GMSDomain = cloudMigration.Key("domain").MustString("")
	cfg.CloudMigration.GMSValidateKeyTimeout = cloudMigration.Key("validate_key_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.GMSStartSnapshotTimeout = cloudMigration.Key("start_snapshot_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.GMSGetSnapshotStatusTimeout = cloudMigration.Key("get_snapshot_status_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.GMSCreateUploadUrlTimeout = cloudMigration.Key("create_upload_url_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.GMSReportEventTimeout = cloudMigration.Key("report_event_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.FetchInstanceTimeout = cloudMigration.Key("fetch_instance_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.CreateAccessPolicyTimeout = cloudMigration.Key("create_access_policy_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.FetchAccessPolicyTimeout = cloudMigration.Key("fetch_access_policy_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.DeleteAccessPolicyTimeout = cloudMigration.Key("delete_access_policy_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.ListTokensTimeout = cloudMigration.Key("list_tokens_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.CreateTokenTimeout = cloudMigration.Key("create_token_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.DeleteTokenTimeout = cloudMigration.Key("delete_token_timeout").MustDuration(5 * time.Second)
	cfg.CloudMigration.TokenExpiresAfter = cloudMigration.Key("token_expires_after").MustDuration(7 * 24 * time.Hour)
	cfg.CloudMigration.IsDeveloperMode = cloudMigration.Key("developer_mode").MustBool(false)
	cfg.CloudMigration.FeedbackURL = cloudMigration.Key("feedback_url").MustString("")
	cfg.CloudMigration.FrontendPollInterval = cloudMigration.Key("frontend_poll_interval").MustDuration(2 * time.Second)

	if cfg.CloudMigration.SnapshotFolder == "" {
		cfg.CloudMigration.SnapshotFolder = filepath.Join(cfg.DataPath, "cloud_migration")
	}
}
