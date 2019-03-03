package rendering

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"time"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/chromedp/chromedp/runner"
	"github.com/grafana/grafana/pkg/middleware"
)

func (rs *RenderingService) renderViaChromeDP(ctx context.Context, opts Opts) (*RenderResult, error) {
	rs.log.Info("Rendering", "path", opts.Path)

	commandCtx, cancel := context.WithTimeout(ctx, opts.Timeout+time.Second*2)
	defer cancel()
	c, err := chromedp.New(commandCtx, chromedp.WithRunnerOptions(
		//runner.Flag("headless", true),
		runner.Flag("window-size", fmt.Sprintf("%d,%d", opts.Width, opts.Height)),
		runner.Flag("disable-gpu", true),
		runner.Flag("disable-web-security", "1"),
	))
	if err != nil {
		return nil, err
	}

	url := rs.getURL(opts.Path)

	pngPath := rs.getFilePathForNewImage()

	renderKey := middleware.AddRenderAuthKey(opts.OrgId, opts.UserId, opts.OrgRole)
	defer middleware.RemoveRenderAuthKey(renderKey)

	err = c.Run(commandCtx, screenshot(
		url, rs.domain, renderKey, pngPath))
	if err != nil {
		return nil, err
	}

	err = c.Shutdown(commandCtx)
	if err != nil {
		return nil, err
	}

	err = c.Wait()
	if err != nil {
		return nil, err
	}

	return &RenderResult{FilePath: pngPath}, nil
}

func screenshot(urlstr, domain, renderKey, outPath string) chromedp.Tasks {
	return chromedp.Tasks{
		chromedp.ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
			success, err := network.SetCookie("renderKey", renderKey).
				WithDomain(domain).
				Do(ctxt, h)
			if err != nil {
				return err
			}
			if !success {
				return errors.New("could not set cookie")
			}
			return nil
		}),
		chromedp.Navigate(urlstr),
		chromedp.Sleep(2 * time.Second),
		chromedp.ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
			_, _, contentRect, err := page.GetLayoutMetrics().Do(ctxt, h)
			if err != nil {
				return err
			}

			v := page.Viewport{
				X:      contentRect.X,
				Y:      contentRect.Y,
				Width:  contentRect.Width,
				Height: contentRect.Height,
				Scale:  1,
			}

			buf, err := page.CaptureScreenshot().WithClip(&v).Do(ctxt, h)
			if err != nil {
				return err
			}

			return ioutil.WriteFile(outPath, buf, 0640)
		}),
	}
}
