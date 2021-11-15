package pipeline

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/live/pipeline/pattern"
	"github.com/grafana/grafana/pkg/services/live/pipeline/tree"
)

func (r ChannelRule) Valid() (bool, string) {
	ok, reason := pattern.Valid(r.Pattern)
	if !ok {
		return false, fmt.Sprintf("invalid pattern: %s", reason)
	}
	if r.Settings.Converter != nil {
		if !typeRegistered(r.Settings.Converter.Type, ConvertersRegistry) {
			return false, fmt.Sprintf("unknown converter type: %s", r.Settings.Converter.Type)
		}
	}
	if len(r.Settings.Subscribers) > 0 {
		for _, sub := range r.Settings.Subscribers {
			if !typeRegistered(sub.Type, SubscribersRegistry) {
				return false, fmt.Sprintf("unknown subscriber type: %s", sub.Type)
			}
		}
	}
	if len(r.Settings.FrameProcessors) > 0 {
		for _, proc := range r.Settings.FrameProcessors {
			if !typeRegistered(proc.Type, FrameProcessorsRegistry) {
				return false, fmt.Sprintf("unknown processor type: %s", proc.Type)
			}
		}
	}
	if len(r.Settings.FrameOutputters) > 0 {
		for _, out := range r.Settings.FrameOutputters {
			if !typeRegistered(out.Type, FrameOutputsRegistry) {
				return false, fmt.Sprintf("unknown output type: %s", out.Type)
			}
		}
	}
	return true, ""
}

func typeRegistered(entityType string, registry []EntityInfo) bool {
	for _, info := range registry {
		if info.Type == entityType {
			return true
		}
	}
	return false
}

func WriteConfigToDto(b WriteConfig) WriteConfigDto {
	secureFields := make(map[string]bool, len(b.SecureSettings))
	for k := range b.SecureSettings {
		secureFields[k] = true
	}
	return WriteConfigDto{
		UID:          b.UID,
		Settings:     b.Settings,
		SecureFields: secureFields,
	}
}

type WriteConfigDto struct {
	UID          string          `json:"uid"`
	Settings     WriteSettings   `json:"settings"`
	SecureFields map[string]bool `json:"secureFields"`
}

type WriteConfigGetCmd struct {
	UID string `json:"uid"`
}

type WriteConfigCreateCmd struct {
	UID            string            `json:"uid"`
	Settings       WriteSettings     `json:"settings"`
	SecureSettings map[string]string `json:"secureSettings"`
}

// TODO: add version field later.
type WriteConfigUpdateCmd struct {
	UID            string            `json:"uid"`
	Settings       WriteSettings     `json:"settings"`
	SecureSettings map[string]string `json:"secureSettings"`
}

type WriteConfigDeleteCmd struct {
	UID string `json:"uid"`
}

type WriteConfig struct {
	OrgId          int64             `json:"-"`
	UID            string            `json:"uid"`
	Settings       WriteSettings     `json:"settings"`
	SecureSettings map[string][]byte `json:"secureSettings,omitempty"`
}

func (r WriteConfig) Valid() (bool, string) {
	if r.UID == "" {
		return false, "uid required"
	}
	if r.Settings.Endpoint == "" {
		return false, "endpoint required"
	}
	return true, ""
}

type BasicAuth struct {
	// User is a user for remote write request.
	User string `json:"user,omitempty"`
	// Password is a plain text non-encrypted password.
	// TODO: remove after integrating with the database.
	Password string `json:"password,omitempty"`
}

type WriteSettings struct {
	// Endpoint to send streaming frames to.
	Endpoint string `json:"endpoint"`
	// BasicAuth is an optional basic auth settings.
	BasicAuth *BasicAuth `json:"basicAuth,omitempty"`
}

type WriteConfigs struct {
	Configs []WriteConfig `json:"writeConfigs"`
}

type ChannelRules struct {
	Rules []ChannelRule `json:"rules"`
}

func checkRulesValid(orgID int64, rules []ChannelRule) (ok bool, reason string) {
	t := tree.New()
	defer func() {
		if r := recover(); r != nil {
			reason = fmt.Sprintf("%v", r)
			ok = false
		}
	}()
	for _, rule := range rules {
		if rule.OrgId == orgID || (rule.OrgId == 0 && orgID == 1) {
			t.AddRoute("/"+rule.Pattern, struct{}{})
		}
	}
	ok = true
	return ok, reason
}

type ChannelRuleCreateCmd struct {
	Pattern  string              `json:"pattern"`
	Settings ChannelRuleSettings `json:"settings"`
}

type ChannelRuleUpdateCmd struct {
	Pattern  string              `json:"pattern"`
	Settings ChannelRuleSettings `json:"settings"`
}

type ChannelRuleDeleteCmd struct {
	Pattern string `json:"pattern"`
}
