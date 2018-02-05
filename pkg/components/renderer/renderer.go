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

	execPath, err := getExecPath()
	if err != nil {
		rendererLog.Error("could not get exec path", "err", err)
		return "", err
	}

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
		chromedp.WithRunnerOptions(
			runner.Path(execPath),
			runner.StartURL("about:blank"),
			runner.Flag("no-sandbox", true),
			runner.Flag("headless", setting.RendererChromiumHeadless),
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
		rendererLog.Error("could not start chrome", "err", err, "exec-path", execPath)
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
