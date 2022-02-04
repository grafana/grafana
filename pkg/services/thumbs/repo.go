package thumbs

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func newThumbnailRepo(store *sqlstore.SQLStore) thumbnailRepo {
	repo := &sqlThumbnailRepository{
		store: store,
	}
	return repo
}

type sqlThumbnailRepository struct {
	store *sqlstore.SQLStore
}

func (r *sqlThumbnailRepository) saveFromFile(filePath string, meta models.DashboardThumbnailMeta, dashboardVersion int) (int64, error) {
	// the filePath variable is never set by the user. it refers to a temporary file created either in
	//   1. thumbs/service.go, when user uploads a thumbnail
	//   2. the rendering service, when image-renderer returns a screenshot
	content, err := os.ReadFile(filepath.Clean(filePath))

	if err != nil {
		tlog.Error("error reading file", "dashboardUID", meta.DashboardUID, "err", err)
		return 0, err
	}

	return r.saveFromBytes(content, getMimeType(filePath), meta, dashboardVersion)
}

func getMimeType(filePath string) string {
	if strings.HasSuffix(filePath, ".webp") {
		return "image/webp"
	}

	return "image/png"
}

func (r *sqlThumbnailRepository) saveFromBytes(content []byte, mimeType string, meta models.DashboardThumbnailMeta, dashboardVersion int) (int64, error) {
	cmd := &models.SaveDashboardThumbnailCommand{
		DashboardThumbnailMeta: meta,
		Image:                  content,
		MimeType:               mimeType,
		DashboardVersion:       dashboardVersion,
	}

	_, err := r.store.SaveThumbnail(cmd)
	if err != nil {
		tlog.Error("error saving to the db", "dashboardUID", meta.DashboardUID, "err", err)
		return 0, err
	}

	return cmd.Result.Id, nil
}

func (r *sqlThumbnailRepository) updateThumbnailState(state models.ThumbnailState, meta models.DashboardThumbnailMeta) error {
	return r.store.UpdateThumbnailState(&models.UpdateThumbnailStateCommand{
		State:                  state,
		DashboardThumbnailMeta: meta,
	})
}

func (r *sqlThumbnailRepository) getThumbnail(meta models.DashboardThumbnailMeta) (*models.DashboardThumbnail, error) {
	query := &models.GetDashboardThumbnailCommand{
		DashboardThumbnailMeta: meta,
	}
	return r.store.GetThumbnail(query)
}

func (r *sqlThumbnailRepository) findDashboardsWithStaleThumbnails() ([]*models.DashboardWithStaleThumbnail, error) {
	return r.store.FindDashboardsWithStaleThumbnails(&models.FindDashboardsWithStaleThumbnailsCommand{
		IncludeManuallyUploadedThumbnails: false,
	})
}
