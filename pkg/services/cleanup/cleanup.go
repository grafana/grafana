package cleanup

import (
	"context"
	"io/ioutil"
	"os"
	"path"
	"time"

	"github.com/grafana/grafana/pkg/services/shorturls"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/setting"
)

type CleanUpService struct {
	log               log.Logger
	Cfg               *setting.Cfg                  `inject:""`
	ServerLockService *serverlock.ServerLockService `inject:""`
	ShortURLService   *shorturls.ShortURLService    `inject:""`
}

func init() {
	registry.RegisterService(&CleanUpService{})
}

func (srv *CleanUpService) Init() error {
	srv.log = log.New("cleanup")
	return nil
}

func (srv *CleanUpService) Run(ctx context.Context) error {
	srv.cleanUpTmpFiles()

	ticker := time.NewTicker(time.Minute * 10)
	for {
		select {
		case <-ticker.C:
			ctxWithTimeout, cancelFn := context.WithTimeout(ctx, time.Minute*9)
			defer cancelFn()

			srv.cleanUpTmpFiles()
			srv.deleteExpiredSnapshots()
			srv.deleteExpiredDashboardVersions()
			srv.cleanUpOldAnnotations(ctxWithTimeout)
			srv.expireOldUserInvites()
			srv.deleteStaleShortURLs()
			err := srv.ServerLockService.LockAndExecute(ctx, "delete old login attempts",
				time.Minute*10, func() {
					srv.deleteOldLoginAttempts()
				})
			if err != nil {
				srv.log.Error("failed to lock and execute cleanup of old login attempts", "error", err)
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (srv *CleanUpService) cleanUpOldAnnotations(ctx context.Context) {
	cleaner := annotations.GetAnnotationCleaner()
	err := cleaner.CleanAnnotations(ctx, srv.Cfg)
	if err != nil {
		srv.log.Error("failed to clean up old annotations", "error", err)
	}
}

func (srv *CleanUpService) cleanUpTmpFiles() {
	if _, err := os.Stat(srv.Cfg.ImagesDir); os.IsNotExist(err) {
		return
	}

	files, err := ioutil.ReadDir(srv.Cfg.ImagesDir)
	if err != nil {
		srv.log.Error("Problem reading image dir", "error", err)
		return
	}

	var toDelete []os.FileInfo
	var now = time.Now()

	for _, file := range files {
		if srv.shouldCleanupTempFile(file.ModTime(), now) {
			toDelete = append(toDelete, file)
		}
	}

	for _, file := range toDelete {
		fullPath := path.Join(srv.Cfg.ImagesDir, file.Name())
		err := os.Remove(fullPath)
		if err != nil {
			srv.log.Error("Failed to delete temp file", "file", file.Name(), "error", err)
		}
	}

	srv.log.Debug("Found old rendered image to delete", "deleted", len(toDelete), "kept", len(files))
}

func (srv *CleanUpService) shouldCleanupTempFile(filemtime time.Time, now time.Time) bool {
	if srv.Cfg.TempDataLifetime == 0 {
		return false
	}

	return filemtime.Add(srv.Cfg.TempDataLifetime).Before(now)
}

func (srv *CleanUpService) deleteExpiredSnapshots() {
	cmd := models.DeleteExpiredSnapshotsCommand{}
	if err := bus.Dispatch(&cmd); err != nil {
		srv.log.Error("Failed to delete expired snapshots", "error", err.Error())
	} else {
		srv.log.Debug("Deleted expired snapshots", "rows affected", cmd.DeletedRows)
	}
}

func (srv *CleanUpService) deleteExpiredDashboardVersions() {
	cmd := models.DeleteExpiredVersionsCommand{}
	if err := bus.Dispatch(&cmd); err != nil {
		srv.log.Error("Failed to delete expired dashboard versions", "error", err.Error())
	} else {
		srv.log.Debug("Deleted old/expired dashboard versions", "rows affected", cmd.DeletedRows)
	}
}

func (srv *CleanUpService) deleteOldLoginAttempts() {
	if srv.Cfg.DisableBruteForceLoginProtection {
		return
	}

	cmd := models.DeleteOldLoginAttemptsCommand{
		OlderThan: time.Now().Add(time.Minute * -10),
	}
	if err := bus.Dispatch(&cmd); err != nil {
		srv.log.Error("Problem deleting expired login attempts", "error", err.Error())
	} else {
		srv.log.Debug("Deleted expired login attempts", "rows affected", cmd.DeletedRows)
	}
}

func (srv *CleanUpService) expireOldUserInvites() {
	maxInviteLifetime := srv.Cfg.UserInviteMaxLifetime

	cmd := models.ExpireTempUsersCommand{
		OlderThan: time.Now().Add(-maxInviteLifetime),
	}
	if err := bus.Dispatch(&cmd); err != nil {
		srv.log.Error("Problem expiring user invites", "error", err.Error())
	} else {
		srv.log.Debug("Expired user invites", "rows affected", cmd.NumExpired)
	}
}

func (srv *CleanUpService) deleteStaleShortURLs() {
	cmd := models.DeleteShortUrlCommand{
		OlderThan: time.Now().Add(-time.Hour * 24 * 7),
	}
	if err := srv.ShortURLService.DeleteStaleShortURLs(context.Background(), &cmd); err != nil {
		srv.log.Error("Problem deleting stale short urls", "error", err.Error())
	} else {
		srv.log.Debug("Deleted short urls", "rows affected", cmd.NumDeleted)
	}
}
