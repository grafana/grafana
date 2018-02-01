package cleanup

import (
	"context"
	"io/ioutil"
	"os"
	"path"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type CleanUpService struct {
	log log.Logger
}

func NewCleanUpService() *CleanUpService {
	return &CleanUpService{
		log: log.New("cleanup"),
	}
}

func (service *CleanUpService) Run(ctx context.Context) error {
	service.log.Info("Initializing CleanUpService")

	g, _ := errgroup.WithContext(ctx)
	g.Go(func() error { return service.start(ctx) })

	err := g.Wait()
	service.log.Info("Stopped CleanUpService", "reason", err)
	return err
}

func (service *CleanUpService) start(ctx context.Context) error {
	service.cleanUpTmpFiles()

	ticker := time.NewTicker(time.Minute * 10)
	for {
		select {
		case <-ticker.C:
			service.cleanUpTmpFiles()
			service.deleteExpiredSnapshots()
			service.deleteExpiredDashboardVersions()
			service.deleteOldLoginAttempts()
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (service *CleanUpService) cleanUpTmpFiles() {
	if _, err := os.Stat(setting.ImagesDir); os.IsNotExist(err) {
		return
	}

	files, err := ioutil.ReadDir(setting.ImagesDir)
	if err != nil {
		service.log.Error("Problem reading image dir", "error", err)
		return
	}

	var toDelete []os.FileInfo
	for _, file := range files {
		if file.ModTime().AddDate(0, 0, 1).Before(time.Now()) {
			toDelete = append(toDelete, file)
		}
	}

	for _, file := range toDelete {
		fullPath := path.Join(setting.ImagesDir, file.Name())
		err := os.Remove(fullPath)
		if err != nil {
			service.log.Error("Failed to delete temp file", "file", file.Name(), "error", err)
		}
	}

	service.log.Debug("Found old rendered image to delete", "deleted", len(toDelete), "keept", len(files))
}

func (service *CleanUpService) deleteExpiredSnapshots() {
	bus.Dispatch(&m.DeleteExpiredSnapshotsCommand{})
}

func (service *CleanUpService) deleteExpiredDashboardVersions() {
	bus.Dispatch(&m.DeleteExpiredVersionsCommand{})
}

func (service *CleanUpService) deleteOldLoginAttempts() {
	if setting.DisableBruteForceLoginProtection {
		return
	}

	cmd := m.DeleteOldLoginAttemptsCommand{
		OlderThan: time.Now().Add(time.Minute * -10),
	}
	if err := bus.Dispatch(&cmd); err != nil {
		service.log.Error("Problem deleting expired login attempts", "error", err.Error())
	} else {
		service.log.Debug("Deleted expired login attempts", "rows affected", cmd.DeletedRows)
	}
}
