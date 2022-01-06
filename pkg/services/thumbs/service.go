package thumbs

import (
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/rendering"
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

	// Form post (from dashboard page)
	SetImage(c *models.ReqContext)

	// Must be admin
	StartCrawler(c *models.ReqContext) response.Response
	StopCrawler(c *models.ReqContext) response.Response
	CrawlerStatus(c *models.ReqContext) response.Response
}

func ProvideService(cfg *setting.Cfg, renderService rendering.Service, gl *live.GrafanaLive) Service {
	if !cfg.IsDashboardPreviesEnabled() {
		return &dummyService{}
	}

	root := filepath.Join(cfg.DataPath, "crawler", "preview")
	tempdir := filepath.Join(cfg.DataPath, "temp")
	_ = os.MkdirAll(root, 0700)
	_ = os.MkdirAll(tempdir, 0700)

	renderer := newSimpleCrawler(root, renderService, gl)
	return &thumbService{
		renderer: renderer,
		root:     root,
		tempdir:  tempdir,
	}
}

type thumbService struct {
	renderer dashRenderer
	root     string
	tempdir  string
}

func (hs *thumbService) Enabled() bool {
	return true
}

func (hs *thumbService) parseImageReq(c *models.ReqContext, checkSave bool) *previewRequest {
	params := web.Params(c.Req)

	size, ok := getPreviewSize(params[":size"])
	if !ok {
		c.JSON(400, map[string]string{"error": "invalid size"})
		return nil
	}

	theme, ok := getTheme(params[":theme"])
	if !ok {
		c.JSON(400, map[string]string{"error": "invalid theme"})
		return nil
	}

	req := &previewRequest{
		OrgID: c.OrgId,
		UID:   params[":uid"],
		Theme: theme,
		Size:  size,
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

func (hs *thumbService) GetImage(c *models.ReqContext) {
	req := hs.parseImageReq(c, false)
	if req == nil {
		return // already returned value
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

	// Create a temporary file within our temp-images directory that follows
	// a particular naming pattern
	tempFile, err := ioutil.TempFile(hs.tempdir, "upload-*")
	if err != nil {
		c.JSON(400, map[string]string{"error": "error creating temp file"})
		fmt.Println("error", err)
		tlog.Info("ERROR", "err", handler.Header)
		return
	}
	defer func() {
		_ = tempFile.Close()
	}()

	// read all of the contents of our uploaded file into a
	// byte array
	fileBytes, err := ioutil.ReadAll(file)
	if err != nil {
		fmt.Println(err)
	}
	// write this byte array to our temporary file
	_, err = tempFile.Write(fileBytes)
	if err != nil {
		c.JSON(400, map[string]string{"error": "error writing file"})
		fmt.Println("error", err)

		return
	}

	p := getFilePath(hs.root, req)
	err = os.Rename(tempFile.Name(), p)
	if err != nil {
		c.JSON(400, map[string]string{"error": "unable to rename file"})
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
	msg, err := hs.renderer.Start(c, cmd.Mode, cmd.Theme)
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
	query := models.GetDashboardQuery{Uid: uid, OrgId: c.OrgId}

	if err := bus.Dispatch(c.Req.Context(), &query); err != nil {
		return 404 // not found
	}

	dash := query.Result

	guardian := guardian.New(c.Req.Context(), dash.Id, c.OrgId, c.SignedInUser)
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
