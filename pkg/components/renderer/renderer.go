package renderer

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/chromedp/chromedp/runner"

	"github.com/chromedp/cdproto/page"

	"github.com/chromedp/cdproto/emulation"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var chromeLog = log.New("chrome")

type rendererImpl struct {
	ctx    context.Context
	cancel context.CancelFunc
	cdp    *chromedp.CDP
	closed bool
}

func NewRenderer(execPath string, headless bool) (Renderer, error) {
	ctx, cancel := context.WithCancel(context.Background())

	cdp, err := chromedp.New(ctx,
		chromedp.WithDebugf(func(msg string, data ...interface{}) {
			logFuncProxy(chromeLog.Debug, msg, data...)
		}),
		chromedp.WithErrorf(func(msg string, data ...interface{}) {
			logFuncProxy(chromeLog.Error, msg, data...)
		}),
		chromedp.WithLogf(func(msg string, data ...interface{}) {
			logFuncProxy(chromeLog.Info, msg, data...)
		}),
		chromedp.WithRunnerOptions(
			runner.Path(execPath),
			runner.StartURL("about:blank"),
			runner.Flag("no-sandbox", true),
			runner.Flag("headless", headless),
			runner.Flag("disable-gpu", true),
			runner.Flag("disable-background-networking", true),
			runner.Flag("disable-background-timer-throttling", true),
			runner.Flag("disable-client-side-phishing-detection", true),
			runner.Flag("disable-default-apps", true),
			runner.Flag("disable-extensions", true),
			runner.Flag("disable-hang-monitor", true),
			runner.Flag("disable-popup-blocking", true),
			runner.Flag("disable-prompt-on-repost", true),
			runner.Flag("disable-sync", true),
			runner.Flag("disable-translate", true),
			runner.Flag("metrics-recording-only", true),
			runner.Flag("no-first-run", true),
			runner.Flag("remote-debugging-port", 9222),
			runner.Flag("safebrowsing-disable-auto-update", true),
			runner.Flag("enable-automation", true),
			runner.Flag("password-store=basic", true),
			runner.Flag("use-mock-keychain", true),
			runner.Flag("headless", true),
			runner.Flag("disable-gpu", true),
			runner.Flag("hide-scrollbars", true),
			runner.Flag("mute-audio", true),
			runner.CmdOpt(func(cmd *exec.Cmd) error {
				cmd.Stdout = log.NewLogWriter(chromeLog, log.LvlDebug, "[stdout] ")
				cmd.Stderr = log.NewLogWriter(chromeLog, log.LvlDebug, "[stderr] ")

				return nil
			}),
		),
	)

	if err != nil {
		if cancel != nil {
			cancel()
		}
		return nil, err
	}

	r := &rendererImpl{
		ctx:    ctx,
		cancel: cancel,
		cdp:    cdp,
		closed: false,
	}

	return r, nil
}

func NewRendererFromSettings() (Renderer, error) {
	execPath, err := getExecPath()
	if err != nil {
		return nil, err
	}

	return NewRenderer(execPath, setting.RendererChromiumHeadless)
}

func (i *rendererImpl) Render(opts Opts) (string, error) {
	if i.closed {
		return "", fmt.Errorf("renderer already closed")
	}

	return i.performRender(opts.Width, opts.Height, opts.OrgID, opts.UserID, opts.OrgRole, opts.Path, opts.Timeout)
}

func (i *rendererImpl) Close() {
	i.cancel()
	i.closed = true
}

func getLocalDomain() string {
	if setting.HttpAddr != setting.DEFAULT_HTTP_ADDR {
		return setting.HttpAddr
	}

	return "localhost"
}

func getURL(path string) string {
	return fmt.Sprintf("%s://%s:%s/%s", setting.Protocol, getLocalDomain(), setting.HttpPort, path)
}

func getRenderKey(OrgID, UserID int64, OrgRole models.RoleType) string {
	rendererLog.Debug("adding render authkey", "orgid", OrgID, "userid", UserID, "role", OrgRole)
	return middleware.AddRenderAuthKey(OrgID, UserID, OrgRole)
}

func getExecPath() (string, error) {
	if setting.RendererChromiumExecPath != "" {
		return setting.RendererChromiumExecPath, nil
	}

	if setting.RendererChromiumRevision == "" {
		return "", fmt.Errorf("Revision of bundled chromium unknown you need to manually set exec path")
	}

	basePath := filepath.Join(setting.HomePath, "tools/chromium", setting.RendererChromiumRevision)
	if runtime.GOOS == "windows" {
		// the same for both 32 and 64bit
		return filepath.Join(basePath, "chrome-win32/chrome.exe"), nil
	} else if runtime.GOOS == "darwin" {
		return filepath.Join(basePath, "chrome-mac/Chromium.app/Contents/MacOS/Chromium"), nil
	} else if runtime.GOOS == "linux" {
		return filepath.Join(basePath, "chrome-linux/chrome"), nil
	}

	return "", fmt.Errorf("Unexpected OS %s you need to manually set chromium exec path", runtime.GOOS)
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

		viewportScale := 1.0
		viewport := page.Viewport{
			X:      0.0,
			Y:      0.0,
			Width:  float64(width),
			Height: float64(height),
			Scale:  viewportScale,
		}

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

func (i *rendererImpl) performRender(width, height int, orgID, userID int64, orgRole models.RoleType, path string, timeout time.Duration) (string, error) {
	renderKey := getRenderKey(orgID, userID, orgRole)
	defer middleware.RemoveRenderAuthKey(renderKey)

	pngPath, _ := filepath.Abs(filepath.Join(setting.ImagesDir, util.GetRandomString(20)))
	pngPath = pngPath + ".png"

	url := getURL(path)
	rendererLog.Debug("taking screenshot", "url", url, "png", pngPath)

	// run task list
	start := time.Now()

	timeoutCtx, timeoutCancel := context.WithTimeout(i.ctx, timeout)
	defer timeoutCancel()
	err := i.cdp.Run(timeoutCtx, screenshotAction(width, height, url, renderKey, pngPath))
	if err != nil {
		rendererLog.Error("could not take screenshot", "error", err)
		return "", fmt.Errorf("Could not run tasklist: %s", err)
	}

	if err = timeoutCtx.Err(); err != nil {
		rendererLog.Error("error during rendering", "err", err)
		return "", fmt.Errorf("Error during rendering: %s", err)
	}

	timeTaken := time.Since(start)
	metrics.M_Render_Time.Observe(float64(timeTaken / time.Millisecond))

	rendererLog.Debug("Image rendered", "path", pngPath, "time", timeTaken)
	return pngPath, nil
}
