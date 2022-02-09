package thumbs

import (
	"errors"
	"fmt"
	"io"
	"io/ioutil"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/segmentio/encoding/json"
)

var (
	tlog log.Logger = log.New("thumbnails")
)

type Service interface {
	Enabled() bool
	GetImage(c *models.ReqContext)

	// from dashboard page
	SetImage(c *models.ReqContext) // form post
	UpdateThumbnailState(c *models.ReqContext)

	// Must be admin
	StartCrawler(c *models.ReqContext) response.Response
	StopCrawler(c *models.ReqContext) response.Response
	CrawlerStatus(c *models.ReqContext) response.Response
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, renderService rendering.Service, gl *live.GrafanaLive, store *sqlstore.SQLStore) Service {
	if !features.IsEnabled(featuremgmt.FlagDashboardPreviews) {
		return &dummyService{}
	}

	thumbnailRepo := newThumbnailRepo(store)
	return &thumbService{
		renderer:      newSimpleCrawler(renderService, gl, thumbnailRepo),
		thumbnailRepo: thumbnailRepo,
	}
}

type thumbService struct {
	renderer      dashRenderer
	thumbnailRepo thumbnailRepo
}

func (hs *thumbService) Enabled() bool {
	return true
}

func (hs *thumbService) parseImageReq(c *models.ReqContext, checkSave bool) *previewRequest {
	params := web.Params(c.Req)

	kind, err := models.ParseThumbnailKind(params[":kind"])
	if err != nil {
		c.JSON(400, map[string]string{"error": "invalid size"})
		return nil
	}

	theme, err := models.ParseTheme(params[":theme"])
	if err != nil {
		c.JSON(400, map[string]string{"error": "invalid theme"})
		return nil
	}

	req := &previewRequest{
		OrgID: c.OrgId,
		UID:   params[":uid"],
		Theme: theme,
		Kind:  kind,
	}

	if len(req.UID) < 1 {
		c.JSON(400, map[string]string{"error": "missing UID"})
		return nil
	}

	// Check permissions and status
	status := hs.getStatus(c, req.UID, checkSave)
	if status != 200 {
		c.JSON(status, map[string]string{"error": fmt.Sprintf("code: %d", status)})
		return nil
	}
	return req
}

type updateThumbnailStateRequest struct {
	State models.ThumbnailState `json:"state" binding:"Required"`
}

func (hs *thumbService) UpdateThumbnailState(c *models.ReqContext) {
	req := hs.parseImageReq(c, false)
	if req == nil {
		return // already returned value
	}

	var body = &updateThumbnailStateRequest{}

	err := web.Bind(c.Req, body)
	if err != nil {
		tlog.Error("Error parsing update thumbnail state request", "dashboardUid", req.UID, "err", err.Error())
		c.JSON(500, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
		return
	}

	err = hs.thumbnailRepo.updateThumbnailState(c.Req.Context(), body.State, models.DashboardThumbnailMeta{
		DashboardUID: req.UID,
		OrgId:        req.OrgID,
		Theme:        req.Theme,
		Kind:         models.ThumbnailKindDefault,
	})

	if err != nil {
		tlog.Error("Error when trying to update thumbnail state", "dashboardUid", req.UID, "err", err.Error(), "newState", body.State)
		c.JSON(500, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
		return
	}

	tlog.Info("Updated dashboard thumbnail state", "dashboardUid", req.UID, "theme", req.Theme, "newState", body.State)
	c.JSON(200, map[string]string{"success": "true"})
}

func (hs *thumbService) GetImage(c *models.ReqContext) {
	req := hs.parseImageReq(c, false)
	if req == nil {
		return // already returned value
	}

	res, err := hs.thumbnailRepo.getThumbnail(c.Req.Context(), models.DashboardThumbnailMeta{
		DashboardUID: req.UID,
		OrgId:        req.OrgID,
		Theme:        req.Theme,
		Kind:         models.ThumbnailKindDefault,
	})

	if errors.Is(err, models.ErrDashboardThumbnailNotFound) {
		c.Resp.WriteHeader(404)
		return
	}

	if err != nil {
		tlog.Error("Error when retrieving thumbnail", "dashboardUid", req.UID, "err", err.Error())
		c.JSON(500, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
		return
	}

	c.Resp.Header().Set("Content-Type", res.MimeType)
	if _, err := c.Resp.Write(res.Image); err != nil {
		tlog.Error("Error writing to response", "dashboardUid", req.UID, "err", err)
	}
}

// Hack for now -- lets you upload images explicitly
func (hs *thumbService) SetImage(c *models.ReqContext) {
	req := hs.parseImageReq(c, false)
	if req == nil {
		return // already returned value
	}

	r := c.Req

	// Parse our multipart form, 10 << 20 specifies a maximum
	// upload of 10 MB files.
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		c.JSON(400, map[string]string{"error": "invalid upload size"})
		return
	}

	// FormFile returns the first file for the given key `myFile`
	// it also returns the FileHeader so we can get the Filename,
	// the Header and the size of the file
	file, handler, err := r.FormFile("file")
	if err != nil {
		c.JSON(400, map[string]string{"error": "missing multi-part form field named 'file'"})
		fmt.Println("error", err)
		return
	}
	defer func() {
		_ = file.Close()
	}()
	tlog.Info("Uploaded File: %+v\n", handler.Filename)
	tlog.Info("File Size: %+v\n", handler.Size)
	tlog.Info("MIME Header: %+v\n", handler.Header)

	fileBytes, err := ioutil.ReadAll(file)
	if err != nil {
		fmt.Println(err)
		c.JSON(400, map[string]string{"error": "error reading file"})
		return
	}

	_, err = hs.thumbnailRepo.saveFromBytes(c.Req.Context(), fileBytes, getMimeType(handler.Filename), models.DashboardThumbnailMeta{
		DashboardUID: req.UID,
		OrgId:        req.OrgID,
		Theme:        req.Theme,
		Kind:         req.Kind,
	}, models.DashboardVersionForManualThumbnailUpload)

	if err != nil {
		c.JSON(400, map[string]string{"error": "error saving thumbnail file"})
		fmt.Println("error", err)
		return
	}

	c.JSON(200, map[string]int{"OK": len(fileBytes)})
}

func (hs *thumbService) StartCrawler(c *models.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(500, "error reading bytes", err)
	}
	cmd := &crawlCmd{}
	err = json.Unmarshal(body, cmd)
	if err != nil {
		return response.Error(500, "error parsing bytes", err)
	}
	if cmd.Mode == "" {
		cmd.Mode = CrawlerModeThumbs
	}
	msg, err := hs.renderer.Start(c, cmd.Mode, cmd.Theme, models.ThumbnailKindDefault)
	if err != nil {
		return response.Error(500, "error starting", err)
	}
	return response.JSON(200, msg)
}

func (hs *thumbService) StopCrawler(c *models.ReqContext) response.Response {
	msg, err := hs.renderer.Stop()
	if err != nil {
		return response.Error(500, "error starting", err)
	}
	return response.JSON(200, msg)
}

func (hs *thumbService) CrawlerStatus(c *models.ReqContext) response.Response {
	msg, err := hs.renderer.Status()
	if err != nil {
		return response.Error(500, "error starting", err)
	}
	return response.JSON(200, msg)
}

// Ideally this service would not require first looking up the full dashboard just to bet the id!
func (hs *thumbService) getStatus(c *models.ReqContext, uid string, checkSave bool) int {
	dashboardID, err := hs.getDashboardId(c, uid)
	if err != nil {
		return 404
	}

	guardian := guardian.New(c.Req.Context(), dashboardID, c.OrgId, c.SignedInUser)
	if checkSave {
		if canSave, err := guardian.CanSave(); err != nil || !canSave {
			return 403 // forbidden
		}
		return 200
	}

	if canView, err := guardian.CanView(); err != nil || !canView {
		return 403 // forbidden
	}

	return 200 // found and OK
}

func (hs *thumbService) getDashboardId(c *models.ReqContext, uid string) (int64, error) {
	query := models.GetDashboardQuery{Uid: uid, OrgId: c.OrgId}

	if err := bus.Dispatch(c.Req.Context(), &query); err != nil {
		return 0, err
	}

	return query.Result.Id, nil
}
