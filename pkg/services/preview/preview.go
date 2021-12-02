package preview

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func ProvideService(cfg *setting.Cfg, renderService rendering.Service) *Service {
	return &Service{
		Cfg:           cfg,
		RenderService: renderService,
	}
}

type Service struct {
	RenderService rendering.Service
	Cfg           *setting.Cfg
}

func (hs *Service) GetDashboard(c *models.ReqContext) {
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

	p := hs.getFilePath(req)
	if _, err := os.Stat(p); errors.Is(err, os.ErrNotExist) {
		c.JSON(202, map[string]string{"path": p, "todo": "queue processing"}) //, "req": req})
		return
	}

	c.Resp.Header().Set("Content-Type", "image/png")
	http.ServeFile(c.Resp, c.Req, p)
}

func (hs *Service) getFilePath(req *previewRequest) string {
	root := "/home/ryan/Pictures/DASH/last"
	return filepath.Join(root, fmt.Sprintf("%s-%s-%s.png", req.UID, req.Size, req.Theme))
}

// Ideally this service would not require first looking up the full dashboard just to bet the id!
func (hs *Service) getStatus(c *models.ReqContext, uid string) int {
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
