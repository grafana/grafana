package thumbs

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/segmentio/encoding/json"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources/permissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type Service interface {
	registry.ProvidesUsageStats
	Run(ctx context.Context) error
	Enabled() bool
	GetImage(c *contextmodel.ReqContext)
	GetDashboardPreviewsSetupSettings(c *contextmodel.ReqContext) dtos.DashboardPreviewsSetupConfig

	// from dashboard page
	SetImage(c *contextmodel.ReqContext) // form post
	UpdateThumbnailState(c *contextmodel.ReqContext)

	// Must be admin
	StartCrawler(c *contextmodel.ReqContext) response.Response
	StopCrawler(c *contextmodel.ReqContext) response.Response
	CrawlerStatus(c *contextmodel.ReqContext) response.Response
}

type thumbService struct {
	scheduleOptions            crawlerScheduleOptions
	renderer                   dashRenderer
	renderingService           rendering.Service
	thumbnailRepo              thumbnailRepo
	lockService                *serverlock.ServerLockService
	features                   featuremgmt.FeatureToggles
	store                      db.DB
	crawlLockServiceActionName string
	log                        log.Logger
	canRunCrawler              bool
	settings                   setting.DashboardPreviewsSettings
	dashboardService           dashboards.DashboardService
	dsUidsLookup               getDatasourceUidsForDashboard
	dsPermissionsService       permissions.DatasourcePermissionsService
	licensing                  licensing.Licensing
	searchService              searchV2.SearchService
}

type crawlerScheduleOptions struct {
	crawlInterval    time.Duration
	tickerInterval   time.Duration
	maxCrawlDuration time.Duration
	crawlerMode      CrawlerMode
	thumbnailKind    ThumbnailKind
	themes           []models.Theme
	auth             CrawlerAuth
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles,
	lockService *serverlock.ServerLockService, renderService rendering.Service,
	gl *live.GrafanaLive, store db.DB, authSetupService CrawlerAuthSetupService,
	dashboardService dashboards.DashboardService, dashboardThumbsService DashboardThumbService, searchService searchV2.SearchService,
	dsPermissionsService permissions.DatasourcePermissionsService, licensing licensing.Licensing) Service {
	if !features.IsEnabled(featuremgmt.FlagDashboardPreviews) {
		return &dummyService{}
	}
	logger := log.New("previews_service")

	thumbnailRepo := newThumbnailRepo(dashboardThumbsService, searchService)

	canRunCrawler := true

	authSetupStarted := time.Now()
	crawlerAuth, err := authSetupService.Setup(context.Background())

	if err != nil {
		logger.Error("Crawler auth setup failed", "err", err, "crawlerAuthSetupTime", time.Since(authSetupStarted))
		canRunCrawler = false
	} else {
		logger.Info("Crawler auth setup complete", "crawlerAuthSetupTime", time.Since(authSetupStarted))
	}

	dsUidsLookup := &dsUidsLookup{
		searchService: searchService,
		crawlerAuth:   crawlerAuth,
		features:      features,
	}

	t := &thumbService{
		licensing:                  licensing,
		renderingService:           renderService,
		renderer:                   newSimpleCrawler(renderService, gl, thumbnailRepo, cfg, cfg.DashboardPreviews, dsUidsLookup.getDatasourceUidsForDashboard),
		thumbnailRepo:              thumbnailRepo,
		store:                      store,
		features:                   features,
		lockService:                lockService,
		crawlLockServiceActionName: "dashboard-crawler",
		searchService:              searchService,
		log:                        logger,
		canRunCrawler:              canRunCrawler,
		dsUidsLookup:               dsUidsLookup.getDatasourceUidsForDashboard,
		settings:                   cfg.DashboardPreviews,
		dsPermissionsService:       dsPermissionsService,
		scheduleOptions: crawlerScheduleOptions{
			tickerInterval:   5 * time.Minute,
			crawlInterval:    cfg.DashboardPreviews.SchedulerInterval,
			maxCrawlDuration: cfg.DashboardPreviews.MaxCrawlDuration,
			crawlerMode:      CrawlerModeThumbs,
			thumbnailKind:    ThumbnailKindDefault,
			themes:           []models.Theme{models.ThemeDark, models.ThemeLight},
			auth:             crawlerAuth,
		},
		dashboardService: dashboardService,
	}

	return t
}

func (hs *thumbService) GetUsageStats(ctx context.Context) map[string]interface{} {
	s := hs.getDashboardPreviewsSetupSettings(ctx)

	stats := make(map[string]interface{})

	if s.SystemRequirements.Met {
		stats["stats.dashboard_previews.system_req_met.count"] = 1
	}

	if s.ThumbnailsExist {
		stats["stats.dashboard_previews.thumbnails_exist.count"] = 1
	}

	return stats
}

func (hs *thumbService) Enabled() bool {
	return hs.features.IsEnabled(featuremgmt.FlagDashboardPreviews)
}

func (hs *thumbService) parseImageReq(c *contextmodel.ReqContext, checkSave bool) *previewRequest {
	params := web.Params(c.Req)

	kind, err := ParseThumbnailKind(params[":kind"])
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
		OrgID: c.OrgID,
		UID:   params[":uid"],
		Theme: theme,
		Kind:  kind,
	}

	if len(req.UID) < 1 {
		c.JSON(400, map[string]string{"error": "missing UID"})
		return nil
	}

	// Check permissions and status
	status, err := hs.getStatus(c, req.UID, checkSave)
	if err != nil {
		c.JSON(status, map[string]string{"error": err.Error()})
		return nil
	}

	if status != 200 {
		c.JSON(status, map[string]string{"error": fmt.Sprintf("code: %d", status)})
		return nil
	}
	return req
}

type updateThumbnailStateRequest struct {
	State ThumbnailState `json:"state" binding:"Required"`
}

func (hs *thumbService) UpdateThumbnailState(c *contextmodel.ReqContext) {
	req := hs.parseImageReq(c, false)
	if req == nil {
		return // already returned value
	}

	var body = &updateThumbnailStateRequest{}

	err := web.Bind(c.Req, body)
	if err != nil {
		hs.log.Error("Error parsing update thumbnail state request", "dashboardUid", req.UID, "err", err.Error())
		c.JSON(500, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
		return
	}

	err = hs.thumbnailRepo.updateThumbnailState(c.Req.Context(), body.State, DashboardThumbnailMeta{
		DashboardUID: req.UID,
		OrgId:        req.OrgID,
		Theme:        req.Theme,
		Kind:         ThumbnailKindDefault,
	})

	if err != nil {
		hs.log.Error("Error when trying to update thumbnail state", "dashboardUid", req.UID, "err", err.Error(), "newState", body.State)
		c.JSON(500, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
		return
	}

	hs.log.Info("Updated dashboard thumbnail state", "dashboardUid", req.UID, "theme", req.Theme, "newState", body.State)
	c.JSON(http.StatusOK, map[string]string{"success": "true"})
}

func (hs *thumbService) GetImage(c *contextmodel.ReqContext) {
	req := hs.parseImageReq(c, false)
	if req == nil {
		return // already returned value
	}

	res, err := hs.thumbnailRepo.getThumbnail(c.Req.Context(), DashboardThumbnailMeta{
		DashboardUID: req.UID,
		OrgId:        req.OrgID,
		Theme:        req.Theme,
		Kind:         ThumbnailKindDefault,
	})

	if errors.Is(err, dashboards.ErrDashboardThumbnailNotFound) {
		c.Resp.WriteHeader(404)
		return
	}

	if err != nil || res == nil {
		hs.log.Error("Error when retrieving thumbnail", "dashboardUid", req.UID, "err", err.Error())
		c.JSON(500, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
		return
	}

	if !hs.hasAccessToPreview(c, res, req) {
		return
	}

	currentEtag := fmt.Sprintf("%d", res.Updated.Unix())
	c.Resp.Header().Set("ETag", currentEtag)

	previousEtag := c.Req.Header.Get("If-None-Match")
	if previousEtag == currentEtag {
		c.Resp.WriteHeader(http.StatusNotModified)
		return
	}

	c.Resp.Header().Set("Content-Type", res.MimeType)
	if _, err := c.Resp.Write(res.Image); err != nil {
		hs.log.Error("Error writing to response", "dashboardUid", req.UID, "err", err)
	}
}

func (hs *thumbService) hasAccessToPreview(c *contextmodel.ReqContext, res *DashboardThumbnail, req *previewRequest) bool {
	if !hs.licensing.FeatureEnabled("accesscontrol.enforcement") {
		return true
	}

	if hs.searchService.IsDisabled() {
		c.JSON(404, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
		return false
	}

	if res.DsUIDs == "" {
		hs.log.Debug("dashboard preview is stale; no datasource uids", "dashboardUid", req.UID)
		c.JSON(404, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
		return false
	}

	var dsUids []string
	err := json.Unmarshal([]byte(res.DsUIDs), &dsUids)

	if err != nil {
		hs.log.Error("Error when retrieving datasource uids", "dashboardUid", req.UID, "err", err)
		c.JSON(404, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
		return false
	}

	accessibleDatasources, err := hs.dsPermissionsService.FilterDatasourceUidsBasedOnQueryPermissions(c.Req.Context(), c.SignedInUser, dsUids)
	if err != nil && !errors.Is(err, permissions.ErrNotImplemented) {
		hs.log.Error("Error when filtering datasource uids", "dashboardUid", req.UID, "err", err)
		c.JSON(500, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
		return false
	}

	if !errors.Is(err, permissions.ErrNotImplemented) {
		canQueryAllDatasources := len(accessibleDatasources) == len(dsUids)
		if !canQueryAllDatasources {
			hs.log.Info("Denied access to dashboard preview", "dashboardUid", req.UID, "err", err, "dashboardDatasources", dsUids, "accessibleDatasources", accessibleDatasources)
			c.JSON(404, map[string]string{"dashboardUID": req.UID, "error": "unknown"})
			return false
		}
	}

	return true
}

func (hs *thumbService) GetDashboardPreviewsSetupSettings(c *contextmodel.ReqContext) dtos.DashboardPreviewsSetupConfig {
	return hs.getDashboardPreviewsSetupSettings(c.Req.Context())
}

func (hs *thumbService) getDashboardPreviewsSetupSettings(ctx context.Context) dtos.DashboardPreviewsSetupConfig {
	systemRequirements := hs.getSystemRequirements(ctx)
	thumbnailsExist, err := hs.thumbnailRepo.doThumbnailsExist(ctx)

	if err != nil {
		return dtos.DashboardPreviewsSetupConfig{
			SystemRequirements: systemRequirements,
			ThumbnailsExist:    false,
		}
	}

	return dtos.DashboardPreviewsSetupConfig{
		SystemRequirements: systemRequirements,
		ThumbnailsExist:    thumbnailsExist,
	}
}

func (hs *thumbService) getSystemRequirements(ctx context.Context) dtos.DashboardPreviewsSystemRequirements {
	res, err := hs.renderingService.HasCapability(ctx, rendering.ScalingDownImages)
	if err != nil {
		hs.log.Error("Error when verifying dashboard previews system requirements thumbnail", "err", err.Error())
		return dtos.DashboardPreviewsSystemRequirements{
			Met: false,
		}
	}

	if !res.IsSupported {
		return dtos.DashboardPreviewsSystemRequirements{
			Met:                                false,
			RequiredImageRendererPluginVersion: res.SemverConstraint,
		}
	}

	return dtos.DashboardPreviewsSystemRequirements{
		Met: true,
	}
}

// Hack for now -- lets you upload images explicitly
func (hs *thumbService) SetImage(c *contextmodel.ReqContext) {
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
	hs.log.Info("Uploaded File: %+v\n", handler.Filename)
	hs.log.Info("File Size: %+v\n", handler.Size)
	hs.log.Info("MIME Header: %+v\n", handler.Header)

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		fmt.Println(err)
		c.JSON(400, map[string]string{"error": "error reading file"})
		return
	}

	dsUids, err := hs.dsUidsLookup(c.Req.Context(), req.UID, req.OrgID)
	if err != nil {
		hs.log.Error("error looking up datasource ids", "err", err, "dashboardUid", req.UID)
		c.JSON(500, map[string]string{"error": "internal server error"})
		return
	}

	_, err = hs.thumbnailRepo.saveFromBytes(c.Req.Context(), fileBytes, getMimeType(handler.Filename), DashboardThumbnailMeta{
		DashboardUID: req.UID,
		OrgId:        req.OrgID,
		Theme:        req.Theme,
		Kind:         req.Kind,
	}, DashboardVersionForManualThumbnailUpload, dsUids)

	if err != nil {
		c.JSON(400, map[string]string{"error": "error saving thumbnail file"})
		fmt.Println("error", err)
		return
	}

	c.JSON(http.StatusOK, map[string]int{"OK": len(fileBytes)})
}

func (hs *thumbService) StartCrawler(c *contextmodel.ReqContext) response.Response {
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

	go hs.runOnDemandCrawl(context.Background(), cmd.Theme, cmd.Mode, ThumbnailKindDefault, rendering.AuthOpts{
		OrgID:   c.OrgID,
		UserID:  c.UserID,
		OrgRole: c.OrgRole,
	})

	status, err := hs.renderer.Status()
	if err != nil {
		return response.Error(500, "error starting", err)
	}

	return response.JSON(http.StatusOK, status)
}

func (hs *thumbService) StopCrawler(c *contextmodel.ReqContext) response.Response {
	msg, err := hs.renderer.Stop()
	if err != nil {
		return response.Error(500, "error starting", err)
	}
	return response.JSON(http.StatusOK, msg)
}

func (hs *thumbService) CrawlerStatus(c *contextmodel.ReqContext) response.Response {
	msg, err := hs.renderer.Status()
	if err != nil {
		return response.Error(500, "error starting", err)
	}
	return response.JSON(http.StatusOK, msg)
}

// Ideally this service would not require first looking up the full dashboard just to bet the id!
func (hs *thumbService) getStatus(c *contextmodel.ReqContext, uid string, checkSave bool) (int, error) {
	guardian, err := guardian.NewByUID(c.Req.Context(), uid, c.OrgID, c.SignedInUser)
	if err != nil {
		return 0, err
	}

	if checkSave {
		if canSave, err := guardian.CanSave(); err != nil || !canSave {
			return 403, nil // forbidden
		}
		return 200, nil
	}

	if canView, err := guardian.CanView(); err != nil || !canView {
		return 403, nil // forbidden
	}

	return 200, nil // found and OK
}

func (hs *thumbService) runOnDemandCrawl(parentCtx context.Context, theme models.Theme, mode CrawlerMode, kind ThumbnailKind, authOpts rendering.AuthOpts) {
	if !hs.canRunCrawler {
		return
	}

	crawlerCtx, cancel := context.WithTimeout(parentCtx, hs.scheduleOptions.maxCrawlDuration)
	defer cancel()

	// wait for at least a minute after the last completed run
	interval := time.Minute
	err := hs.lockService.LockAndExecute(crawlerCtx, hs.crawlLockServiceActionName, interval, func(ctx context.Context) {
		if err := hs.renderer.Run(crawlerCtx, hs.scheduleOptions.auth, mode, theme, kind); err != nil {
			hs.log.Error("On demand crawl error", "mode", mode, "theme", theme, "kind", kind, "userId", authOpts.UserID, "orgId", authOpts.OrgID, "orgRole", authOpts.OrgRole)
		}
	})

	if err != nil {
		hs.log.Error("On demand crawl lock error", "err", err)
	}
}

func (hs *thumbService) runScheduledCrawl(parentCtx context.Context) {
	crawlerCtx, cancel := context.WithTimeout(parentCtx, hs.scheduleOptions.maxCrawlDuration)
	defer cancel()

	err := hs.lockService.LockAndExecute(crawlerCtx, hs.crawlLockServiceActionName, hs.scheduleOptions.crawlInterval, func(ctx context.Context) {
		for _, theme := range hs.scheduleOptions.themes {
			if err := hs.renderer.Run(crawlerCtx, hs.scheduleOptions.auth, hs.scheduleOptions.crawlerMode, theme, hs.scheduleOptions.thumbnailKind); err != nil {
				hs.log.Error("Scheduled crawl error", "theme", theme, "kind", hs.scheduleOptions.thumbnailKind, "err", err)
			}
		}
	})

	if err != nil {
		hs.log.Error("Scheduled crawl lock error", "err", err)
	}
}

func (hs *thumbService) Run(ctx context.Context) error {
	if !hs.canRunCrawler {
		return nil
	}

	gc := time.NewTicker(hs.scheduleOptions.tickerInterval)

	for {
		select {
		case <-gc.C:
			go hs.runScheduledCrawl(ctx)
		case <-ctx.Done():
			hs.log.Debug("Grafana is shutting down - stopping dashboard crawler")
			gc.Stop()

			return nil
		}
	}
}
