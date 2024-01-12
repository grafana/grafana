package slack

import (
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
)

// TODO: Duplicated from the rendering service - maybe we can do this in another way to not duplicate this
func (s *SlackService) getGrafanaURL() string {
	if s.cfg.RendererCallbackUrl != "" {
		return s.cfg.RendererCallbackUrl
	}

	protocol := s.cfg.Protocol
	switch protocol {
	case setting.HTTPScheme:
		protocol = "http"
	case setting.HTTP2Scheme, setting.HTTPSScheme:
		protocol = "https"
	default:
		// TODO: Handle other schemes?
	}

	subPath := ""
	if s.cfg.ServeFromSubPath {
		subPath = s.cfg.AppSubURL
	}

	domain := "localhost"
	if s.cfg.HTTPAddr != "0.0.0.0" {
		domain = s.cfg.HTTPAddr
	}
	return fmt.Sprintf("%s://%s:%s%s/", protocol, domain, s.cfg.HTTPPort, subPath)
}

func (s *SlackService) getImageURL(imageName string) string {
	grafanaURL := s.getGrafanaURL()
	return fmt.Sprintf("%s%s/%s", grafanaURL, "public/img/attachments", imageName)
}
