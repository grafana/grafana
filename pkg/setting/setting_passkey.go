package setting

import "github.com/grafana/grafana/pkg/util"

type PasskeySettings struct {
	Enabled                 bool
	RPID                    string // relying-party ID, e.g. "grafana.example.com"
	RPName                  string
	RPOrigins               []string // e.g. ["https://grafana.example.com"]
	RequireUserVerification bool
}

func (cfg *Cfg) readPasskeySettings() {
	sec := cfg.Raw.Section("auth.passkey")
	settings := PasskeySettings{}
	settings.Enabled = sec.Key("enabled").MustBool(false)
	settings.RPID = valueAsString(sec, "rp_id", "")
	settings.RPName = valueAsString(sec, "rp_name", "Grafana")
	settings.RPOrigins = util.SplitString(valueAsString(sec, "rp_origins", ""))
	settings.RequireUserVerification = sec.Key("require_user_verification").MustBool(true)
	cfg.Passkey = settings
}
