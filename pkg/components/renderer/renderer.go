package renderer

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"time"

	"github.com/chromedp/cdproto/page"

	"github.com/chromedp/cdproto/emulation"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"

	"strconv"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type RenderOpts struct {
	Path           string
	Width          string
	Height         string
	Timeout        string
	OrgId          int64
	UserId         int64
	OrgRole        models.RoleType
	Timezone       string
	IsAlertContext bool
	Encoding       string
}

var ErrTimeout = errors.New("Timeout error. You can set timeout in seconds with &timeout url parameter")
var rendererLog = log.New("png-renderer")
var chromeLog = log.New("chrome")

func getLocalDomain() string {
	if setting.HttpAddr != setting.DEFAULT_HTTP_ADDR {
		return setting.HttpAddr
	}

	return "localhost"
}

func getURL(path string) string {
	return fmt.Sprintf("%s://%s:%s/%s", setting.Protocol, getLocalDomain(), setting.HttpPort, path)
}

func getRenderKey(params *RenderOpts) string {
	orgRole := params.OrgRole
	if params.IsAlertContext {
		orgRole = models.ROLE_ADMIN
	}
	rendererLog.Debug("adding render authkey", "orgid", params.OrgId, "userid", params.UserId, "role", orgRole)
	return middleware.AddRenderAuthKey(params.OrgId, params.UserId, orgRole)
}

func screenshotAction(width, height int, url, renderKey, pngPath string) chromedp.Tasks {
	var buf []byte
	return chromedp.Tasks{
		setViewportAction(width, height),
		setCookieAction(getLocalDomain(), "renderKey", renderKey),
		chromedp.Navigate(url),
		chromedp.WaitReady(`.renderingComplete`, chromedp.ByQuery),
		chromedp.CaptureScreenshot(&buf),
		chromedp.ActionFunc(func(context.Context, cdp.Executor) error {
			return ioutil.WriteFile(pngPath, buf, 0644)
		}),
	}
}

func setViewportAction(width, height int) chromedp.ActionFunc {
	return func(ctx context.Context, h cdp.Executor) error {
		var deviceWidth int64
		var deviceHeigth int64
		scaleFactor := 1.0

		viewportScale := 2.0
		viewport := page.Viewport{0.0, 0.0, float64(width), float64(height), viewportScale}

		err := emulation.SetDeviceMetricsOverride(deviceWidth, deviceHeigth, scaleFactor, false).
			WithViewport(&viewport).Do(ctx, h)
		if err != nil {
			rendererLog.Error("could not override device metrics", "err", err)
		}
		return err
	}
}

func setCookieAction(domain, name, value string) chromedp.ActionFunc {
	return func(ctx context.Context, h cdp.Executor) error {
		success, err := network.SetCookie(name, value).WithDomain(domain).Do(ctx, h)
		if err != nil {
			rendererLog.Error("Could not set cookie", "name", name, "value", value, "error", err)
			return err
		}
		if !success {
			rendererLog.Error("Could not set cookie", "name", name, "value", value)
			return errors.New("Could not set cookie")
		}
		return nil
	}
}

func logFuncProxy(f chromedp.LogFunc, msg string, data ...interface{}) {
	formatted := fmt.Sprintf(msg, data...)
	f(formatted)
}

func RenderToPng(params *RenderOpts) (string, error) {
	renderKey := getRenderKey(params)
	defer middleware.RemoveRenderAuthKey(renderKey)

	timeout, err := strconv.Atoi(params.Timeout)
	if err != nil {
		timeout = 15
	}

	width, err := strconv.Atoi(params.Width)
	if err != nil {
		rendererLog.Error("could not convert width to int", "width", params.Width, "err", err)
		return "", fmt.Errorf("Could not convert width to int: %s", err)
	}

	height, err := strconv.Atoi(params.Height)
	if err != nil {
		rendererLog.Error("could not convert height to int", "height", params.Height, "err", err)
		return "", fmt.Errorf("Could not convert height to int: %s", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	chrome, err := chromedp.New(ctx,
		chromedp.WithDebugf(func(msg string, data ...interface{}) {
			logFuncProxy(chromeLog.Debug, msg, data...)
		}),
		chromedp.WithErrorf(func(msg string, data ...interface{}) {
			logFuncProxy(chromeLog.Error, msg, data...)
		}),
		chromedp.WithLogf(func(msg string, data ...interface{}) {
			logFuncProxy(chromeLog.Info, msg, data...)
		}),
	)
	if err != nil {
		rendererLog.Error("could not start chrome", "error", err)
		return "", fmt.Errorf("Could not start chrome: %s", err)
	}

	pngPath, _ := filepath.Abs(filepath.Join(setting.ImagesDir, util.GetRandomString(20)))
	pngPath = pngPath + ".png"

	url := getURL(params.Path)
	rendererLog.Debug("taking screenshot", "url", url, "png", pngPath)

	// run task list
	start := time.Now()

	timeoutCtx, timeoutCancel := context.WithTimeout(ctx, time.Duration(timeout)*time.Second)
	defer timeoutCancel()
	err = chrome.Run(timeoutCtx, screenshotAction(width, height, getURL(params.Path), renderKey, pngPath))
	if err != nil {
		rendererLog.Error("could not take screenshot", "error", err)
		return "", fmt.Errorf("Could not run tasklist: %s", err)
	}

	if err = timeoutCtx.Err(); err != nil {
		rendererLog.Error("error during rendering", "err", err)
		return "", err
	}

	timeTaken := time.Since(start) / time.Millisecond
	metrics.M_Render_Time.Observe(float64(timeTaken))

	rendererLog.Debug("Image rendered", "path", pngPath)
	return pngPath, nil
}
