//"I want to be a cleaner, just like you," said Mathilda
//"Okay," replied Leon

package backgroundtasks

import (
	"context"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/models"
)

var (
	tlog log.Logger = log.New("ticker")
)

func Init(ctx context.Context) error {
	g, _ := errgroup.WithContext(ctx)
	g.Go(func() error { return start(ctx) })

	return g.Wait()
}

func start(ctx context.Context) error {
	go cleanup(time.Now())

	ticker := time.NewTicker(time.Hour * 1)
	for {
		select {
		case tick := <-ticker.C:
			go cleanup(tick)
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func cleanup(now time.Time) {
	err := bus.Publish(&models.HourCommand{Time: now})
	if err != nil {
		tlog.Error("Cleanup job failed", "error", err)
	}
}
