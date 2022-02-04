package thumbs

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/errgroup"

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
		tlog.Warn("Error reading status", "err", err)
		return
	}
	msg, err := json.Marshal(s)
	if err != nil {
		tlog.Warn("Error making message", "err", err)
		return
	}
	err = r.glive.Publish(r.opts.OrgID, "grafana/broadcast/crawler", msg)
	if err != nil {
		tlog.Warn("Error Publish message", "err", err)
		return
	}
}

func (r *simpleCrawler) Run(ctx context.Context, authOpts rendering.AuthOpts, mode CrawlerMode, theme models.Theme, thumbnailKind models.ThumbnailKind) error {
	if r.IsRunning() {
		tlog.Info("Already running")
		return nil
	}

	r.queueMutex.Lock()

	now := time.Now()

	items, err := r.thumbnailRepo.findDashboardsWithStaleThumbnails(theme, thumbnailKind)
	if err != nil {
		tlog.Error("Error when fetching dashboards with stale thumbnails", "err", err.Error())
		return err
	}

	r.mode = mode
	r.thumbnailKind = thumbnailKind
	r.opts = rendering.Opts{
		AuthOpts: authOpts,
		TimeoutOpts: rendering.TimeoutOpts{
			Timeout:                  10 * time.Second,
			RequestTimeoutMultiplier: 3,
		},
		Theme:           theme,
		ConcurrentLimit: 10,
	}
	renderingSession, err := r.renderService.CreateRenderingSession(ctx, r.opts.AuthOpts, rendering.SessionOpts{
		Expiry:                     5 * time.Minute,
		RefreshExpiryOnEachRequest: true,
	})
	if err != nil {
		tlog.Error("Error when creating rendering session", "err", err.Error())
		return err
	}

	r.renderingSession = renderingSession
	r.queue = items
	r.status = crawlStatus{
		Started:  now,
		State:    running,
		Complete: 0,
	}
	r.broadcastStatus()
	r.queueMutex.Unlock()

	tlog.Info("Starting dashboard crawler", "dashboardsToCrawl", len(items))

	group, gCtx := errgroup.WithContext(ctx)
	// create a pool of workers
	for i := 0; i < r.threadCount; i++ {

		walkerId := i
		group.Go(func() error {
			r.walk(walkerId, gCtx)
			return nil
		})

		// wait 1/2 second before starting a new thread
		time.Sleep(500 * time.Millisecond)
	}

	err = group.Wait()
	if err != nil {
		tlog.Error("Crawl ended with an error", "err", err)
	}

	r.walkFinished()
	r.broadcastStatus()
	return err
}

func (r *simpleCrawler) IsRunning() bool {
	r.statusMutex.Lock()
	defer r.statusMutex.Unlock()
	return r.status.State == running
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
	r.statusMutex.Lock()
	defer r.statusMutex.Unlock()

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
	r.statusMutex.Lock()
	defer r.statusMutex.Unlock()

	return r.status.State == running
}

func (r *simpleCrawler) walk(id int, ctx context.Context) {
	for {
		if !r.shouldWalk() {
			break
		}

		item := r.next()
		if item == nil {
			break
		}

		url := models.GetKioskModeDashboardUrl(item.Uid, item.Slug)
		tlog.Info("Getting dashboard thumbnail", "walkerId", id, "dashboardUID", item.Uid, "url", url)

		res, err := r.renderService.Render(ctx, rendering.Opts{
			Width:             320,
			Height:            240,
			Path:              strings.TrimPrefix(url, "/"),
			AuthOpts:          r.opts.AuthOpts,
			TimeoutOpts:       r.opts.TimeoutOpts,
			ConcurrentLimit:   r.opts.ConcurrentLimit,
			Theme:             r.opts.Theme,
			DeviceScaleFactor: -5, // negative numbers will render larger then scale down
		}, r.renderingSession)
		if err != nil {
			tlog.Warn("Error getting image", "walkerId", id, "dashboardUID", item.Uid, "url", url, "err", err)
			r.newErrorResult()
		} else if res.FilePath == "" {
			tlog.Warn("Error getting image... no response", "walkerId", id, "dashboardUID", item.Uid, "url", url)
			r.newErrorResult()
		} else if strings.Contains(res.FilePath, "public/img") {
			tlog.Warn("Error getting image... internal result", "walkerId", id, "dashboardUID", item.Uid, "url", url, "img", res.FilePath)
			r.newErrorResult()
		} else {
			func() {
				defer func() {
					err := os.Remove(res.FilePath)
					if err != nil {
						tlog.Error("Failed to remove thumbnail temp file", "walkerId", id, "dashboardUID", item.Uid, "url", url, "err", err)
					}
				}()

				thumbnailId, err := r.thumbnailRepo.saveFromFile(res.FilePath, models.DashboardThumbnailMeta{
					DashboardUID: item.Uid,
					OrgId:        item.OrgId,
					Theme:        r.opts.Theme,
					Kind:         r.thumbnailKind,
				}, item.Version)

				if err != nil {
					tlog.Warn("Error saving image image", "walkerId", id, "dashboardUID", item.Uid, "url", url, "err", err)
					r.newErrorResult()
				} else {
					tlog.Info("Saved thumbnail", "walkerId", id, "dashboardUID", item.Uid, "url", url, "thumbnailId", thumbnailId)
					r.newSuccessResult()
				}
			}()
		}
		r.broadcastStatus()
	}

	tlog.Info("Walker finished", "walkerId", id)
}
