package thumbs

import (
	"bufio"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"io/ioutil"
	"os"
	"strings"
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

func (r *sqlThumbnailRepository) saveFromFile(filePath string, meta models.DashboardThumbnailMeta) (int64, error) {
	file, err := os.Open(filePath)
	if err != nil {
		tlog.Error("error opening file", "dashboardUID", meta.DashboardUID, "err", err)
		return 0, err
	}

	reader := bufio.NewReader(file)
	content, err := ioutil.ReadAll(reader)

	if err != nil {
		tlog.Error("error reading file", "dashboardUID", meta.DashboardUID, "err", err)
		return 0, err
	}

	return r.saveFromBytes(content, getMimeType(filePath), meta)
}

func getMimeType(filePath string) string {
	if strings.HasSuffix(filePath, ".webp") {
		return "image/webp"
	}

	return "image/png"
}

func (r *sqlThumbnailRepository) saveFromBytes(content []byte, mimeType string, meta models.DashboardThumbnailMeta) (int64, error) {
	cmd := &models.SaveDashboardThumbnailCommand{
		DashboardThumbnailMeta: meta,
		Image:                  content,
		MimeType:               mimeType,
	}

	_, err := r.store.SaveThumbnail(cmd)
	if err != nil {
		tlog.Error("error saving to the db", "dashboardUID", meta.DashboardUID, "err", err)
		return 0, err
	}

	return cmd.Result.Id, nil
}

func (r *sqlThumbnailRepository) getThumbnail(meta models.DashboardThumbnailMeta) (*models.DashboardThumbnail, error) {
	query := &models.GetDashboardThumbnailCommand{
		DashboardThumbnailMeta: meta,
	}
	return r.store.GetThumbnail(query)
}
