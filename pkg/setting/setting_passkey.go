package setting

import (
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/util"
)

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

	if settings.Enabled {
		if err := validatePasskeySettings(settings); err != nil {
			cfg.Logger.Warn("Passkey auth is enabled but misconfigured; disabling it", "err", err)
			settings.Enabled = false
		}
	}

	cfg.Passkey = settings
}

// validatePasskeySettings checks that the relying-party config is usable. It returns an error
// describing the first problem found, or nil if the config is valid.
func validatePasskeySettings(s PasskeySettings) error {
	if s.RPID == "" {
		return errors.New("rp_id must be set")
	}
	if len(s.RPOrigins) == 0 {
		return errors.New("rp_origins must be set")
	}
	for _, origin := range s.RPOrigins {
		u, err := url.Parse(origin)
		if err != nil {
			return fmt.Errorf("invalid rp_origin %q: %w", origin, err)
		}
		host := u.Hostname()
		if host == "" {
			return fmt.Errorf("rp_origin %q has no host", origin)
		}
		// rp_id must equal the origin host or be a parent domain on a label boundary, so a
		// look-alike host such as "notexample.com" is not accepted for rp_id "example.com".
		if host != s.RPID && !strings.HasSuffix(host, "."+s.RPID) {
			return fmt.Errorf("rp_id %q is not a registrable domain suffix of origin %q", s.RPID, origin)
		}
	}
	return nil
}
