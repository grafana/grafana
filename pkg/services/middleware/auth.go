package middleware

import "github.com/grafana/grafana/pkg/models"

func (s *MiddlewareService) SnapshotPublicModeOrSignedIn(c *models.ReqContext) {
	if s.Cfg.SnapshotPublicMode {
		return
	}

	_, err := c.Invoke(ReqSignedIn)
	if err != nil {
		c.JsonApiErr(500, "Failed to invoke required signed in middleware", err)
	}
}
