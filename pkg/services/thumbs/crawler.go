package thumbs

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/rendering"
)

type simpleCrawler struct {
	renderService rendering.Service
	threadCount   int

	glive            *live.GrafanaLive
	thumbnailRepo    thumbnailRepo
	mode             CrawlerMode
	thumbnailKind    models.ThumbnailKind
	opts             rendering.Opts
	status           crawlStatus
	queue            []*models.DashboardWithStaleThumbnail
	mu               sync.Mutex
	renderingSession rendering.Session
}

func newSimpleCrawler(renderService rendering.Service, gl *live.GrafanaLive, repo thumbnailRepo) dashRenderer {
	c := &simpleCrawler{
		renderService: renderService,
		threadCount:   6,
		glive:         gl,
		thumbnailRepo: repo,
		status: crawlStatus{
			State:    "init",
			Complete: 0,
			Queue:    0,
		},
		queue: nil,
	}
	c.broadcastStatus()
	return c
}

func (r *simpleCrawler) next() *models.DashboardWithStaleThumbnail {
	if r.queue == nil || len(r.queue) < 1 {
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	v := r.queue[0]
	r.queue = r.queue[1:]
	return v
}

func (r *simpleCrawler) broadcastStatus() {
	s, err := r.Status()
	if err != nil {
		tlog.Warn("error reading status")
		return
	}
	msg, err := json.Marshal(s)
	if err != nil {
		tlog.Warn("error making message")
		return
	}
	err = r.glive.Publish(r.opts.OrgID, "grafana/broadcast/crawler", msg)
	if err != nil {
		tlog.Warn("error Publish message")
		return
	}
}

func (r *simpleCrawler) Start(c *models.ReqContext, mode CrawlerMode, theme rendering.Theme, thumbnailKind models.ThumbnailKind) (crawlStatus, error) {
	if r.status.State == "running" {
		tlog.Info("already running")
		return r.Status()
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()

	items, err := r.thumbnailRepo.findDashboardsWithStaleThumbnails()
	if err != nil {
		tlog.Error("error when fetching stale ", "err", err.Error())
		return crawlStatus{
			Started:  now,
			Finished: now,
			Last:     now,
			State:    "stopped",
			Complete: 0,
		}, err
	}

	r.mode = mode
	r.thumbnailKind = thumbnailKind
	r.opts = rendering.Opts{
		AuthOpts: rendering.AuthOpts{
			OrgID:   c.OrgId,
			UserID:  c.UserId,
			OrgRole: c.OrgRole,
		},
		TimeoutOpts: rendering.TimeoutOpts{
			Timeout:                  10 * time.Second,
			RequestTimeoutMultiplier: 3,
		},
		Theme:           theme,
		ConcurrentLimit: 10,
	}
	renderingSession, err := r.renderService.CreateRenderingSession(context.Background(), r.opts.AuthOpts, rendering.SessionOpts{
		Expiry:                     5 * time.Minute,
		RefreshExpiryOnEachRequest: true,
	})
	if err != nil {
		tlog.Error("error when creating rendering session", "err", err.Error())
		return crawlStatus{
			Started:  now,
			Finished: now,
			Last:     now,
			State:    "stopped",
			Complete: 0,
		}, err
	}

	r.renderingSession = renderingSession
	r.queue = items
	r.status = crawlStatus{
		Started:  now,
		State:    "running",
		Complete: 0,
	}
	r.broadcastStatus()

	tlog.Info("Starting ", "no", len(items))

	// create a pool of workers
	for i := 0; i < r.threadCount; i++ {
		go r.walk()

		// wait 1/2 second before starting a new thread
		time.Sleep(500 * time.Millisecond)
	}

	r.broadcastStatus()
	return r.Status()
}

func (r *simpleCrawler) Stop() (crawlStatus, error) {
	// cheap hack!
	if r.status.State == "running" {
		r.status.State = "stopping"
	}
	return r.Status()
}

func (r *simpleCrawler) Status() (crawlStatus, error) {
	status := crawlStatus{
		State:    r.status.State,
		Started:  r.status.Started,
		Complete: r.status.Complete,
		Errors:   r.status.Errors,
		Queue:    len(r.queue),
		Last:     r.status.Last,
	}
	return status, nil
}

func (r *simpleCrawler) walk() {
	for {
		if r.status.State != "running" {
			break
		}

		item := r.next()
		if item == nil {
			break
		}

		tlog.Info("GET THUMBNAIL", "url", item.Uid)

		url := models.GetDashboardUrl(item.Uid, item.Slug)
		// Hack (for now) pick a URL that will render
		panelURL := strings.TrimPrefix(url, "/") + "?kiosk"
		res, err := r.renderService.Render(context.Background(), rendering.Opts{
			Width:             320,
			Height:            240,
			Path:              panelURL,
			AuthOpts:          r.opts.AuthOpts,
			TimeoutOpts:       r.opts.TimeoutOpts,
			ConcurrentLimit:   r.opts.ConcurrentLimit,
			Theme:             r.opts.Theme,
			DeviceScaleFactor: -5, // negative numbers will render larger then scale down
		}, r.renderingSession)
		if err != nil {
			tlog.Warn("error getting image", "err", err)
			r.status.Errors++
		} else if res.FilePath == "" {
			tlog.Warn("error getting image... no response")
			r.status.Errors++
		} else if strings.Contains(res.FilePath, "public/img") {
			tlog.Warn("error getting image... internal result", "img", res.FilePath)
			r.status.Errors++
		} else {
			func() {
				defer func() {
					err := os.Remove(res.FilePath)
					if err != nil {
						tlog.Error("failed to remove thumbnail temp file", "dashboardUID", item.Uid, "err", err)
					}
				}()

				thumbnailId, err := r.thumbnailRepo.saveFromFile(res.FilePath, models.DashboardThumbnailMeta{
					DashboardUID: item.Uid,
					Theme:        string(r.opts.Theme),
					Kind:         r.thumbnailKind,
				}, item.Version)

				if err != nil {
					r.status.Errors++
				} else {
					tlog.Info("saved thumbnail", "img", url, "thumbnailId", thumbnailId)
					r.status.Complete++
				}
			}()
		}

		r.status.Last = time.Now()
		r.broadcastStatus()
	}

	r.status.State = "stopped"
	r.status.Finished = time.Now()
	tlog.Info("Crawler finished", "startTime", r.status.Started, "endTime", r.status.Finished, "durationInSeconds", int64(time.Since(r.status.Started)/time.Second))
	r.broadcastStatus()
}
