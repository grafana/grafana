package thumbs

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/search"
)

type dashItem struct {
	uid string
	url string
	id  int64
}

type simpleCrawler struct {
	renderService rendering.Service
	threadCount   int

	glive         *live.GrafanaLive
	thumbnailRepo thumbnailRepo
	mode          CrawlerMode
	thumbnailKind models.ThumbnailKind
	opts          rendering.Opts
	status        crawlStatus
	queue         []dashItem
	mu            sync.Mutex
}

func newSimpleCrawler(renderService rendering.Service, gl *live.GrafanaLive, repo thumbnailRepo) dashRenderer {
	c := &simpleCrawler{
		renderService: renderService,
		threadCount:   1,
		glive:         gl,
		thumbnailRepo: repo,
		status: crawlStatus{
			State:    "init",
			Complete: 0,
			Queue:    0,
		},
		queue: make([]dashItem, 0),
	}
	c.broadcastStatus()
	return c
}

func (r *simpleCrawler) next() *dashItem {
	if len(r.queue) < 1 {
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()

	v := r.queue[0]
	r.queue = r.queue[1:]
	return &v
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

func (r *simpleCrawler) queueRender(p string, req *previewRequest) *previewResponse {
	go func() {
		fmt.Printf("todo? queue")
	}()

	return &previewResponse{
		Code: 202,
		Path: p,
	}
}

func (r *simpleCrawler) Start(c *models.ReqContext, mode CrawlerMode, theme rendering.Theme, thumbnailKind models.ThumbnailKind) (crawlStatus, error) {
	if r.status.State == "running" {
		tlog.Info("already running")
		return r.Status()
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	searchQuery := search.Query{
		SignedInUser: c.SignedInUser,
		OrgId:        c.OrgId,
	}

	err := bus.Dispatch(context.Background(), &searchQuery)
	if err != nil {
		return crawlStatus{}, err
	}

	queue := make([]dashItem, 0, len(searchQuery.Result))
	for _, v := range searchQuery.Result {
		if v.Type == search.DashHitDB {
			queue = append(queue, dashItem{
				uid: v.UID,
				url: v.URL,
				id:  v.ID,
			})
		}
	}
	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(queue), func(i, j int) { queue[i], queue[j] = queue[j], queue[i] })

	r.mode = mode
	r.thumbnailKind = thumbnailKind
	r.opts = rendering.Opts{
		OrgID:           c.OrgId,
		UserID:          c.UserId,
		OrgRole:         c.OrgRole,
		Theme:           theme,
		ConcurrentLimit: 10,
	}
	r.queue = queue
	r.status = crawlStatus{
		Started:  time.Now(),
		State:    "running",
		Complete: 0,
	}
	r.broadcastStatus()

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
		if r.status.State == "stopping" {
			break
		}

		item := r.next()
		if item == nil {
			break
		}

		tlog.Info("GET THUMBNAIL", "url", item.url)

		// Hack (for now) pick a URL that will render
		panelURL := strings.TrimPrefix(item.url, "/") + "?kiosk"
		res, err := r.renderService.Render(context.Background(), rendering.Opts{
			Width:             320,
			Height:            240,
			Path:              panelURL,
			OrgID:             r.opts.OrgID,
			UserID:            r.opts.UserID,
			ConcurrentLimit:   r.opts.ConcurrentLimit,
			OrgRole:           r.opts.OrgRole,
			Theme:             r.opts.Theme,
			Timeout:           10 * time.Second,
			DeviceScaleFactor: -5, // negative numbers will render larger then scale down
		})
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
						tlog.Error("failed to remove thumbnail temp file", "dashboardUID", item.uid, "err", err)
					}
				}()

				thumbnailId, err := r.thumbnailRepo.saveFromFile(res.FilePath, models.DashboardThumbnailMeta{
					DashboardUID: item.uid,
					Theme:        string(r.opts.Theme),
					Kind:         r.thumbnailKind,
				})

				if err != nil {
					r.status.Errors++
				} else {
					tlog.Info("saved thumbnail", "img", item.url, "thumbnailId", thumbnailId)
					r.status.Complete++
				}
			}()
		}

		time.Sleep(5 * time.Second)
		r.status.Last = time.Now()
		r.broadcastStatus()
	}

	r.status.State = "stopped"
	r.status.Finished = time.Now()
	r.broadcastStatus()
}
