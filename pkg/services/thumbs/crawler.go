package thumbs

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
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
	logger           log.Logger
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
		queue:  nil,
		logger: log.New("thumbnails_crawler"),
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
		r.logger.Warn("Error reading status", "error", err)
		return
	}
	msg, err := json.Marshal(s)
	if err != nil {
		r.logger.Warn("Error making message", "error", err)
		return
	}
	err = r.glive.Publish(r.opts.OrgID, "grafana/broadcast/crawler", msg)
	if err != nil {
		r.logger.Warn("Error Publish message", "error", err)
		return
	}
}

func (r *simpleCrawler) Start(c *models.ReqContext, mode CrawlerMode, theme models.Theme, thumbnailKind models.ThumbnailKind) (crawlStatus, error) {
	r.queueMutex.Lock()
	defer r.queueMutex.Unlock()

	if r.status.State == running {
		r.logger.Info("Crawler already running")
		return r.Status()
	}

	now := time.Now()

	// TODO: how theming work with stale thumbnails? I tried to start crawler with light theme but no stale dashboards found.
	items, err := r.thumbnailRepo.findDashboardsWithStaleThumbnails()
	if err != nil {
		r.logger.Error("Error when fetching dashboards with stale thumbnails", "err", err)
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
	// TODO: Should we create session if no items found by findDashboardsWithStaleThumbnails?
	renderingSession, err := r.renderService.CreateRenderingSession(context.Background(), r.opts.AuthOpts, rendering.SessionOpts{
		Expiry:                     5 * time.Minute,
		RefreshExpiryOnEachRequest: true,
	})
	if err != nil {
		r.logger.Error("Error when creating rendering session", "err", err)
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

	r.logger.Info("Starting dashboard crawler", "dashboardsToCrawl", len(items))

	go func() {
		var wg sync.WaitGroup
		wg.Add(r.threadCount)
		// create a pool of workers
		for i := 0; i < r.threadCount; i++ {
			go func() {
				defer wg.Done()
				r.walk()
			}()
			// wait 1/2 second before starting a new thread
			// TODO: why we are sleeping here?
			time.Sleep(500 * time.Millisecond)
		}
		wg.Wait()
		r.walkFinished()
		r.broadcastStatus()
	}()

	// TODO: what we broadcasting here?
	r.broadcastStatus()
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
	r.logger.Info("Crawler finished", "startTime", r.status.Started, "endTime", r.status.Finished, "duration", time.Since(r.status.Started))
}

func (r *simpleCrawler) shouldWalk() bool {
	r.statusMutex.RLock()
	defer r.statusMutex.RUnlock()

	return r.status.State == running
}

func (r *simpleCrawler) walk() {
	for {
		if !r.shouldWalk() {
			break
		}

		item := r.next()
		if item == nil {
			break
		}

		url := models.GetKioskModeDashboardUrl(item.Uid, item.Slug)
		r.logger.Info("Getting dashboard thumbnail", "dashboardUID", item.Uid, "url", url)

		res, err := r.renderService.Render(context.Background(), rendering.Opts{
			Width:             320,
			Height:            240,
			Path:              strings.TrimPrefix(url, "/"),
			AuthOpts:          r.opts.AuthOpts,
			TimeoutOpts:       r.opts.TimeoutOpts,
			ConcurrentLimit:   r.opts.ConcurrentLimit,
			Theme:             r.opts.Theme,
			DeviceScaleFactor: -5, // negative numbers will render larger than scale down.
		}, r.renderingSession)
		if err != nil {
			r.logger.Warn("Error getting image", "dashboardUID", item.Uid, "url", url, "err", err)
			r.newErrorResult()
		} else if res.FilePath == "" {
			r.logger.Warn("Error getting image... no response", "dashboardUID", item.Uid, "url", url)
			r.newErrorResult()
		} else if strings.Contains(res.FilePath, "public/img") {
			r.logger.Warn("Error getting image... internal result", "dashboardUID", item.Uid, "url", url, "img", res.FilePath)
			r.newErrorResult()
		} else {
			func() {
				defer func() {
					// TODO: should we remove this file for previous if/else branches?
					err := os.Remove(res.FilePath)
					if err != nil {
						r.logger.Error("Failed to remove thumbnail temp file", "dashboardUID", item.Uid, "url", url, "err", err)
					}
				}()

				thumbnailId, err := r.thumbnailRepo.saveFromFile(res.FilePath, models.DashboardThumbnailMeta{
					DashboardUID: item.Uid,
					OrgId:        item.OrgId,
					Theme:        r.opts.Theme,
					Kind:         r.thumbnailKind,
				}, item.Version)

				if err != nil {
					r.logger.Warn("Error saving image image", "dashboardUID", item.Uid, "url", url, "err", err)
					r.newErrorResult()
				} else {
					r.logger.Info("Saved thumbnail", "dashboardUID", item.Uid, "url", url, "thumbnailId", thumbnailId)
					r.newSuccessResult()
				}
			}()
		}
		r.broadcastStatus()
	}
}
