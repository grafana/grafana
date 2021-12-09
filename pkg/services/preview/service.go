package preview

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/segmentio/encoding/json"
)

var FEATURE_TOGGLE = "dashboardPreviews"

type Service interface {
	Enabled() bool
	GetImage(c *models.ReqContext)

	// Must be admin
	StartCrawler(c *models.ReqContext) response.Response
	StopCrawler(c *models.ReqContext) response.Response
}

func ProvideService(cfg *setting.Cfg, renderService rendering.Service) Service {
	enabled := cfg.FeatureToggles[FEATURE_TOGGLE]
	root := filepath.Join(cfg.DataPath, "crawler", "preview")
	renderer := newDummyRenderer(root)
	if enabled {
		exportFolder := filepath.Join(cfg.DataPath, "crawler", "export")
		url := strings.TrimSuffix(cfg.RendererUrl, "/render") + "/scan"

		renderer = newRenderHttp(url, crawConfig{
			URL:               strings.TrimSuffix(cfg.RendererCallbackUrl, "/"),
			ScreenshotsFolder: root,
			ExportFolder:      exportFolder,
		})
	}

	return &previewService{
		enabled:  enabled,
		renderer: renderer,
	}
}

type previewService struct {
	enabled  bool
	renderer dashRenderer
}

func (hs *previewService) Enabled() bool {
	return hs.enabled
}

func (hs *previewService) GetImage(c *models.ReqContext) {
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
			if strings.HasSuffix(rsp.Path, ".webp") {
				c.Resp.Header().Set("Content-Type", "image/webp")
			} else if strings.HasSuffix(rsp.Path, ".png") {
				c.Resp.Header().Set("Content-Type", "image/png")
			}
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

func (hs *previewService) StartCrawler(c *models.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(500, "error reading bytes", err)
	}
	cmd := &crawlCmd{}
	err = json.Unmarshal(body, cmd)
	if err != nil {
		return response.Error(500, "error parsing bytes", err)
	}
	cmd.Action = "start"

	msg, err := hs.renderer.CrawlerCmd(cmd)
	if err != nil {
		return response.Error(500, "error starting", err)
	}

	header := make(http.Header)
	header.Set("Content-Type", "application/json")
	return response.CreateNormalResponse(header, msg, 200)
}

func (hs *previewService) StopCrawler(c *models.ReqContext) response.Response {
	_, err := hs.renderer.CrawlerCmd(&crawlCmd{
		Action: "stop",
	})
	if err != nil {
		return response.Error(500, "error stopping crawler", err)
	}

	result := make(map[string]string)
	result["message"] = "Stopping..."
	return response.JSON(200, result)
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
