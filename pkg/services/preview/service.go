package preview

import (
	"fmt"
	"net/http"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var FEATURE_TOGGLE = "dashboardPreviews"

type Service interface {
	Enabled() bool
	GetDashboard(c *models.ReqContext)
}

func ProvideService(cfg *setting.Cfg, renderService rendering.Service) Service {
	enabled := cfg.FeatureToggles[FEATURE_TOGGLE]
	root := filepath.Join(cfg.DataPath, "previews", "dash")

	return &previewService{
		enabled:  enabled,
		renderer: newDummyRenderer(root),
	}
}

type previewService struct {
	enabled  bool
	renderer dashRenderer
}

func (hs *previewService) Enabled() bool {
	return hs.enabled
}

func (hs *previewService) GetDashboard(c *models.ReqContext) {
	if !hs.enabled {
		c.JSON(400, map[string]string{"error": "feature not enabled"})
		return
	}

	params := web.Params(c.Req)

	size, ok := getPreviewSize(params[":size"])
	if !ok {
		c.JSON(400, map[string]string{"error": "invalid size"})
		return
	}

	theme, ok := getTheme(params[":theme"])
	if !ok {
		c.JSON(400, map[string]string{"error": "invalid theme"})
		return
	}

	req := &previewRequest{
		Kind:  "dash",
		OrgID: c.OrgId,
		UID:   params[":uid"],
		Theme: theme,
		Size:  size,
	}

	if len(req.UID) < 1 {
		c.JSON(400, map[string]string{"error": "missing UID"})
		return
	}

	// Check permissions and status
	status := hs.getStatus(c, req.UID)
	if status != 200 {
		c.JSON(status, map[string]string{"error": fmt.Sprintf("code: %d", status)})
		return
	}

	rsp := hs.renderer.GetPreview(req)
	if rsp.Code == 200 {
		if rsp.Path != "" {
			c.Resp.Header().Set("Content-Type", "image/png")
			http.ServeFile(c.Resp, c.Req, rsp.Path)
			return
		}
		if rsp.URL != "" {
			// todo redirect
			fmt.Printf("TODO redirect: %s\n", rsp.URL)
		}
	}

	if rsp.Code == 202 {
		c.JSON(202, map[string]string{"path": rsp.Path, "todo": "queue processing"})
		return
	}

	c.JSON(500, map[string]string{"path": rsp.Path, "error": "unknown!"})
}

// Ideally this service would not require first looking up the full dashboard just to bet the id!
func (hs *previewService) getStatus(c *models.ReqContext, uid string) int {
	query := models.GetDashboardQuery{Uid: uid, OrgId: c.OrgId}

	if err := bus.DispatchCtx(c.Req.Context(), &query); err != nil {
		return 404 // not found
	}

	dash := query.Result

	guardian := guardian.New(c.Req.Context(), dash.Id, c.OrgId, c.SignedInUser)
	if canView, err := guardian.CanView(); err != nil || !canView {
		return 403 // forbidden
	}

	return 200 // found and OK
}
