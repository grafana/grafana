package rendering

import (
	"context"
	"net/url"
	"strings"
)

// Settings is an immutable snapshot used for one render request.
type Settings struct {
	CallbackURL     string
	Domain          string
	TenantID        string
	ConcurrentLimit int
}

type SettingsProvider func(context.Context) (Settings, error)

func (s Settings) callbackURL(path string) string {
	separator := "?"
	if strings.Contains(path, "?") {
		separator = "&"
	}

	return strings.TrimRight(s.CallbackURL, "/") + "/" + strings.TrimLeft(path, "/") + separator + "render=1"
}

func (s Settings) domain() string {
	if s.Domain != "" {
		return s.Domain
	}

	u, err := url.Parse(s.CallbackURL)
	if err != nil {
		return ""
	}

	return u.Hostname()
}
