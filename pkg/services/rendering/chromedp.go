package rendering

import (
	"context"
	"io/ioutil"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/util/errutil"
	"golang.org/x/xerrors"
)

func (rs *RenderingService) renderViaChromeDP(ctx context.Context, opts Opts) (*RenderResult, error) {
	rs.log.Info("Rendering", "path", opts.Path)

	commandCtx, cancel := newChromeContext(ctx, opts)
	defer cancel()

	url := rs.getURL(opts.Path)
	pngPath := rs.getFilePathForNewImage()
	renderKey := middleware.AddRenderAuthKey(opts.OrgId, opts.UserId, opts.OrgRole)
	defer middleware.RemoveRenderAuthKey(renderKey)

	var buf []byte
	rs.log.Debug("Running chrome commands")
	err := chromedp.Run(commandCtx, screenshot(url, rs.domain, renderKey, &buf))
	if err != nil {
		return nil, errutil.Wrap("Failed to run screenshot commands", err)
	}

	rs.log.Debug("Writing buffer to file", "len(buf)", len(buf), "path", pngPath)
	err = ioutil.WriteFile(pngPath, buf, 0640)
	if err != nil {
		return nil, errutil.Wrap("Failed to write screenshot", err)
	}

	return &RenderResult{FilePath: pngPath}, nil
}

func newChromeContext(ctx context.Context, opts Opts) (context.Context, context.CancelFunc) {
	commandCtx, cancel := context.WithTimeout(ctx, opts.Timeout)
	commandCtx, _ = chromedp.NewExecAllocator(commandCtx,
		chromedp.NoFirstRun,
		chromedp.NoDefaultBrowserCheck,
		// Can be commented out to see what is going on in the chrome browser
		chromedp.Headless,
		chromedp.DisableGPU,
		chromedp.WindowSize(opts.Width, opts.Height),
	)
	commandCtx, _ = chromedp.NewContext(commandCtx)
	return commandCtx, cancel
}

func screenshot(urlstr, domain, renderKey string, buf *[]byte) chromedp.Tasks {
	return chromedp.Tasks{
		setRenderKeyCookie(renderKey, domain),
		chromedp.Navigate(urlstr),
		chromedp.WaitVisible(".grafana-app", chromedp.ByQuery),
		takeFullPageScreenShot(buf),
	}
}

func setRenderKeyCookie(renderKey string, domain string) chromedp.Action {
	return chromedp.ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		success, err := network.SetCookie("renderKey", renderKey).
			WithDomain(domain).
			Do(ctxt, h)
		if err != nil {
			return err
		}
		if !success {
			return xerrors.New("could not set cookie")
		}
		return nil
	})
}

func takeFullPageScreenShot(buf *[]byte) chromedp.Action {
	return chromedp.ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		// Using CaptureScreenshot instead of chromedp.Screenshot as we want full screen screenshot and not only
		// of a specified DOM node.
		b, err := page.CaptureScreenshot().Do(ctxt, h)
		if err != nil {
			return err
		}
		*buf = b
		return nil
	})
}
