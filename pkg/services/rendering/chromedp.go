package rendering

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"time"

	"github.com/chromedp/cdproto"
	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/util/errutil"
	"golang.org/x/xerrors"
)

type NetworkStatus struct {
	lastFinish       time.Time
	inFlightRequests int
}

func (rs *RenderingService) renderViaChromeDP(ctx context.Context, opts Opts) (*RenderResult, error) {
	rs.log.Info("Rendering", "path", opts.Path)

	commandCtx, cancel, messageChan := newChromeContext(ctx, opts)
	defer cancel()

	networkStatus := getNetworkStatus(messageChan, ctx)

	url := rs.getURL(opts.Path)
	pngPath := rs.getFilePathForNewImage()
	renderKey := middleware.AddRenderAuthKey(opts.OrgId, opts.UserId, opts.OrgRole)
	defer middleware.RemoveRenderAuthKey(renderKey)

	var buf []byte
	rs.log.Debug("Running chrome commands")
	err := chromedp.Run(commandCtx, screenshot(url, rs.domain, renderKey, &buf, opts.UsePDF, networkStatus))
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

func newChromeContext(ctx context.Context, opts Opts) (context.Context, context.CancelFunc, chan string) {
	commandCtx, cancel := context.WithTimeout(ctx, opts.Timeout)
	commandCtx, _ = chromedp.NewExecAllocator(commandCtx,
		chromedp.NoFirstRun,
		chromedp.NoDefaultBrowserCheck,
		// Can be commented out to see what is going on in the chrome browser
		// Interestingly pdf generation does not work in non headless mode and fails with `PrintToPDF is not implemented`
		chromedp.Headless,
		chromedp.DisableGPU,
		chromedp.WindowSize(opts.Width, opts.Height),
	)
	messageChan := make(chan string)
	listener := makeMessageListener(messageChan)
	commandCtx, _ = chromedp.NewContext(
		commandCtx,
		chromedp.WithLogf(listener),
		chromedp.WithErrorf(listener),
		chromedp.WithDebugf(listener),
	)
	return commandCtx, cancel, messageChan
}

func screenshot(urlstr, domain, renderKey string, buf *[]byte, usePdf bool, networkStatus *NetworkStatus) chromedp.Tasks {
	tasks := chromedp.Tasks{
		network.Enable(),
		page.Enable(),
		setRenderKeyCookie(renderKey, domain),
		chromedp.Navigate(urlstr),
		waitOnNetwork(networkStatus),
		//chromedp.WaitVisible(".flot-base", chromedp.ByQuery),
	}
	if usePdf {
		tasks = append(tasks, takeFullPagePDF(buf))
	} else {
		tasks = append(tasks, takeFullPageScreenShot(buf))
	}
	return tasks
}

func setRenderKeyCookie(renderKey string, domain string) chromedp.Action {
	return chromedp.ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		success, err := network.SetCookie("renderKey", renderKey).
			WithDomain(domain).
			Do(ctxt, h)
		if err != nil {
			return errutil.Wrap("Failed to set render key cookie", err)
		}
		if !success {
			return xerrors.New("Failed to set cookie but no error was returned")
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
			return errutil.Wrap("Failed to print pdf", err)
		}
		*buf = b
		return nil
	})
}

func takeFullPagePDF(buf *[]byte) chromedp.Action {
	return chromedp.ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		b, err := page.
			PrintToPDF().
			WithPrintBackground(true).
			WithLandscape(true).
			Do(ctxt, h)
		if err != nil {
			return errutil.Wrap("Failed to print pdf", err)
		}
		*buf = b
		return nil
	})
}

func waitOnNetwork(networkStatus *NetworkStatus) chromedp.Action {
	return chromedp.ActionFunc(func(ctx context.Context, h cdp.Executor) error {
		c := make(chan interface{})
		go func() {
			t := time.NewTicker(500 * time.Millisecond)
			for {
				select {
				case <-t.C:
					if time.Now().Sub(networkStatus.lastFinish) > 500*time.Millisecond && networkStatus.inFlightRequests == 0 {
						c <- true
						t.Stop()
						return
					}
				}
			}
		}()
		<-c
		return nil
	})
}

func makeMessageListener(messageChan chan string) func(string, ...interface{}) {
	return func(s string, m ...interface{}) {
		// Taken from https://github.com/chromedp/chromedp/issues/252
		for _, elem := range m {
			var msg cdproto.Message
			var msgIn struct {
				SessionId string `json:"sessionId"`
				Message   string `json:"message"`
			}
			var msgLast cdproto.Message
			// The CDP messages are sent as strings so we need to convert them back
			err := json.Unmarshal([]byte(fmt.Sprintf("%s", elem)), &msg)
			if err != nil {
				continue
			}
			err = json.Unmarshal(msg.Params, &msgIn)
			if err != nil {
				continue
			}
			err = json.Unmarshal([]byte(msgIn.Message), &msgLast)
			if err != nil {
				continue
			}
			messageChan <- string(msgLast.Method)
		}
	}
}

func getNetworkStatus(messageChan chan string, ctx context.Context) *NetworkStatus {
	networkStatus := &NetworkStatus{}
	go func() {
		for {
			select {
			case msg := <-messageChan:
				if msg == "Network.requestWillBeSent" {
					networkStatus.inFlightRequests += 1
				}
				if msg == "Network.loadingFinished" {
					networkStatus.inFlightRequests -= 1
					networkStatus.lastFinish = time.Now()
				}
			case <-ctx.Done():
				return
			}
		}
	}()
	return networkStatus
}
