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
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	registry.RegisterService(&RenderService{})
}

type RenderService struct {
	log log.Logger
	cdp *chromedp.CDP
}

func (rs *RenderService) Init() error {
	rs.log = log.New("renderer")
	return nil
}

func (rs *RenderService) getChrome(ctx context.Context) (*chromedp.CDP, error) {
	execPath, err := rs.getExecPath()
	rs.log.Info("Chromepath", "path", execPath)
	if err != nil {
		return nil, err
	}

	chromeInstance, err := chromedp.New(ctx,
		chromedp.WithDebugf(func(msg string, data ...interface{}) {
			// logFuncProxy(rs.log.Debug, msg, data...)
		}),
		chromedp.WithErrorf(func(msg string, data ...interface{}) {
			logFuncProxy(rs.log.Error, msg, data...)
		}),
		chromedp.WithLogf(func(msg string, data ...interface{}) {
			logFuncProxy(rs.log.Info, msg, data...)
		}),
		chromedp.WithRunnerOptions(
			runner.Path(execPath),
			runner.StartURL("about:blank"),
			runner.Flag("no-sandbox", true),
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
			runner.Flag("headless", false),
			runner.Flag("disable-gpu", true),
			runner.Flag("hide-scrollbars", true),
			runner.Flag("mute-audio", true),
			runner.CmdOpt(func(cmd *exec.Cmd) error {
				cmd.Stdout = log.NewLogWriter(rs.log, log.LvlDebug, "[stdout] ")
				cmd.Stderr = log.NewLogWriter(rs.log, log.LvlDebug, "[stderr] ")

				return nil
			}),
		),
	)

	if err != nil {
		return nil, err
	}

	return chromeInstance, nil
}

func (rs *RenderService) Render(opts Opts) (string, error) {
	// create context & start chrome
	ctx, cancelFunc := context.WithTimeout(context.Background(), opts.Timeout)
	defer cancelFunc()

	chromeInstance, err := rs.getChrome(ctx)
	if err != nil {
		return "", err
	}

	// get render auth key
	renderKey := rs.getRenderKey(opts.OrgId, opts.UserId, opts.OrgRole)
	defer middleware.RemoveRenderAuthKey(renderKey)

	// build image disk path
	pngPath, _ := filepath.Abs(filepath.Join(setting.ImagesDir, util.GetRandomString(20)))
	pngPath = pngPath + ".png"

	// build full absolute render url
	url := getURL(opts.Path)

	// run task list
	start := time.Now()

	err = chromeInstance.Run(ctx, rs.getScreenshotAction(opts.Width, opts.Height, url, renderKey, pngPath))
	if err != nil {
		rs.log.Error("could not take screenshot", "error", err)
		return "", fmt.Errorf("Could not run tasklist: %s", err)
	}

	if err = ctx.Err(); err != nil {
		rs.log.Error("error during rendering", "err", err)
		return "", fmt.Errorf("Error during rendering: %s", err)
	}

	time.Sleep(time.Second * 1)
	var buf []byte
	err = chromeInstance.Run(ctx, chromedp.Tasks{
		chromedp.CaptureScreenshot(&buf),
		chromedp.ActionFunc(func(context.Context, cdp.Executor) error {
			return ioutil.WriteFile(pngPath, buf, 0644)
		}),
	})

	timeTaken := time.Since(start)

	rs.log.Debug("Image rendered", "path", pngPath, "time", timeTaken)
	return pngPath, nil
}

func getLocalDomain() string {
	if setting.HttpAddr != setting.DEFAULT_HTTP_ADDR {
		return setting.HttpAddr
	}

	return "localhost"
}

func getURL(path string) string {
	// return "http://localhost:3000/api"
	return fmt.Sprintf("%s://%s:%s/%s", setting.Protocol, getLocalDomain(), setting.HttpPort, path)
}

func (rs *RenderService) getRenderKey(orgId, userId int64, orgRole models.RoleType) string {
	rs.log.Debug("adding render authkey", "orgid", orgId, "userid", userId, "role", orgRole)
	return middleware.AddRenderAuthKey(orgId, userId, orgRole)
}

func (rs *RenderService) getExecPath() (string, error) {
	// if setting.RendererChromiumExecPath != "" {
	// 	return setting.RendererChromiumExecPath, nil
	// }
	//
	// if setting.RendererChromiumRevision == "" {
	// 	return "", fmt.Errorf("Revision of bundled chromium unknown you need to manually set exec path")
	// }

	basePath := filepath.Join(setting.HomePath, "tools")
	if runtime.GOOS == "windows" {
		// the same for both 32 and 64bit
		return filepath.Join(basePath, "chrome-win32/chrome.exe"), nil
	} else if runtime.GOOS == "darwin" {
		// return filepath.Join(basePath, "chrome-mac/Chromium.app/Contents/MacOS/Chromium"), nil
		return filepath.Join(basePath, "chrome-mac/Chrome.app/Contents/MacOS/Chrome"), nil
	} else if runtime.GOOS == "linux" {
		return filepath.Join(basePath, "chrome-linux/chrome"), nil
	}

	return "", fmt.Errorf("Unexpected OS %s you need to manually set chromium exec path", runtime.GOOS)
}

func (rs *RenderService) getScreenshotAction(width, height int, url, renderKey, pngPath string) chromedp.Tasks {
	// var buf []byte
	return chromedp.Tasks{
		rs.getViewportAction(width, height),
		rs.getCookieAction(getLocalDomain(), "renderKey", renderKey),
		chromedp.Navigate(url),
		// chromedp.CaptureScreenshot(&buf),
		// chromedp.ActionFunc(func(context.Context, cdp.Executor) error {
		// 	return ioutil.WriteFile(pngPath, buf, 0644)
		// }),
	}
}

func (rs *RenderService) getViewportAction(width, height int) chromedp.ActionFunc {
	return func(ctx context.Context, h cdp.Executor) error {
		var deviceWidth int64
		var deviceHeigth int64
		scaleFactor := 1.0

		viewportScale := 2.0
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
			rs.log.Error("could not override device metrics", "err", err)
		}
		return err
	}
}

func (rs *RenderService) getCookieAction(domain, name, value string) chromedp.ActionFunc {
	return func(ctx context.Context, h cdp.Executor) error {
		success, err := network.SetCookie(name, value).WithDomain(domain).Do(ctx, h)
		if err != nil {
			rs.log.Error("Could not set cookie", "name", name, "value", value, "error", err)
			return err
		}
		if !success {
			rs.log.Error("Could not set cookie", "name", name, "value", value)
			return errors.New("Could not set cookie")
		}
		return nil
	}
}

func logFuncProxy(f chromedp.LogFunc, msg string, data ...interface{}) {
	formatted := fmt.Sprintf(msg, data...)
	f(formatted)
}
