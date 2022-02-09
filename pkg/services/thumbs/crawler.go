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
	statusMutex      sync.RWMutex
	queue            []*models.DashboardWithStaleThumbnail
	queueMutex       sync.Mutex
	renderingSession rendering.Session
}

func newSimpleCrawler(renderService rendering.Service, gl *live.GrafanaLive, repo thumbnailRepo) dashRenderer {
	c := &simpleCrawler{
		renderService: renderService,
		threadCount:   6,
		glive:         gl,
		thumbnailRepo: repo,
		status: crawlStatus{
			State:    initializing,
			Complete: 0,
			Queue:    0,
		},
		queue: nil,
	}
	c.broadcastStatus()
	return c
}

func (r *simpleCrawler) next() *models.DashboardWithStaleThumbnail {
	r.queueMutex.Lock()
	defer r.queueMutex.Unlock()

	if r.queue == nil || len(r.queue) < 1 {
		return nil
	}

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

func (r *simpleCrawler) Start(c *models.ReqContext, mode CrawlerMode, theme models.Theme, thumbnailKind models.ThumbnailKind) (crawlStatus, error) {
	if r.status.State == running {
		tlog.Info("already running")
		return r.Status()
	}

	r.queueMutex.Lock()
	defer r.queueMutex.Unlock()

	now := time.Now()

	ctx := c.Req.Context()
	items, err := r.thumbnailRepo.findDashboardsWithStaleThumbnails(ctx)
	if err != nil {
		tlog.Error("error when fetching dashboards with stale thumbnails", "err", err.Error())
		return crawlStatus{
			Started:  now,
			Finished: now,
			Last:     now,
			State:    stopped,
			Complete: 0,
		}, err
	}

	if len(items) == 0 {
		return crawlStatus{
			Started:  now,
			Finished: now,
			Last:     now,
			State:    stopped,
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
			State:    stopped,
			Complete: 0,
		}, err
	}

	r.renderingSession = renderingSession
	r.queue = items
	r.status = crawlStatus{
		Started:  now,
		State:    running,
		Complete: 0,
	}
	r.broadcastStatus()

	tlog.Info("Starting dashboard crawler", "dashboardsToCrawl", len(items))

	// create a pool of workers
	for i := 0; i < r.threadCount; i++ {
		go r.walk(ctx)
	}
	return r.Status()
}

func (r *simpleCrawler) Stop() (crawlStatus, error) {
	r.statusMutex.Lock()
	if r.status.State == running {
		r.status.State = stopping
	}
	r.statusMutex.Unlock()

	return r.Status()
}

func (r *simpleCrawler) Status() (crawlStatus, error) {
	r.statusMutex.RLock()
	defer r.statusMutex.RUnlock()

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

func (r *simpleCrawler) newErrorResult() {
	r.statusMutex.Lock()
	defer r.statusMutex.Unlock()

	r.status.Errors++
	r.status.Last = time.Now()
}

func (r *simpleCrawler) newSuccessResult() {
	r.statusMutex.Lock()
	defer r.statusMutex.Unlock()

	r.status.Complete++
	r.status.Last = time.Now()
}

func (r *simpleCrawler) walkFinished() {
	r.statusMutex.Lock()
	defer r.statusMutex.Unlock()

	r.status.State = stopped
	r.status.Finished = time.Now()
	tlog.Info("Crawler finished", "startTime", r.status.Started, "endTime", r.status.Finished, "durationInSeconds", int64(time.Since(r.status.Started)/time.Second))
}

func (r *simpleCrawler) shouldWalk() bool {
	r.statusMutex.RLock()
	defer r.statusMutex.RUnlock()

	return r.status.State == running
}

func (r *simpleCrawler) walk(ctx context.Context) {
	for {
		if !r.shouldWalk() {
			break
		}

		item := r.next()
		if item == nil {
			break
		}

		url := models.GetKioskModeDashboardUrl(item.Uid, item.Slug)
		tlog.Info("Getting dashboard thumbnail", "dashboardUID", item.Uid, "url", url)

		res, err := r.renderService.Render(context.Background(), rendering.Opts{
			Width:             320,
			Height:            240,
			Path:              strings.TrimPrefix(url, "/"),
			AuthOpts:          r.opts.AuthOpts,
			TimeoutOpts:       r.opts.TimeoutOpts,
			ConcurrentLimit:   r.opts.ConcurrentLimit,
			Theme:             r.opts.Theme,
			DeviceScaleFactor: -5, // negative numbers will render larger and then scale down.
		}, r.renderingSession)
		if err != nil {
			tlog.Warn("error getting image", "dashboardUID", item.Uid, "url", url, "err", err)
			r.newErrorResult()
		} else if res.FilePath == "" {
			tlog.Warn("error getting image... no response", "dashboardUID", item.Uid, "url", url)
			r.newErrorResult()
		} else if strings.Contains(res.FilePath, "public/img") {
			tlog.Warn("error getting image... internal result", "dashboardUID", item.Uid, "url", url, "img", res.FilePath)
			// rendering service returned a static error image - we should not remove that file
			r.newErrorResult()
		} else {
			func() {
				defer func() {
					err := os.Remove(res.FilePath)
					if err != nil {
						tlog.Error("failed to remove thumbnail temp file", "dashboardUID", item.Uid, "url", url, "err", err)
					}
				}()

				thumbnailId, err := r.thumbnailRepo.saveFromFile(ctx, res.FilePath, models.DashboardThumbnailMeta{
					DashboardUID: item.Uid,
					OrgId:        item.OrgId,
					Theme:        r.opts.Theme,
					Kind:         r.thumbnailKind,
				}, item.Version)

				if err != nil {
					tlog.Warn("error saving image image", "dashboardUID", item.Uid, "url", url, "err", err)
					r.newErrorResult()
				} else {
					tlog.Info("saved thumbnail", "dashboardUID", item.Uid, "url", url, "thumbnailId", thumbnailId)
					r.newSuccessResult()
				}
			}()
		}
		r.broadcastStatus()
	}

	r.walkFinished()
	r.broadcastStatus()
}
