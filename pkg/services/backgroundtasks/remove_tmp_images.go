package backgroundtasks

import (
	"io/ioutil"
	"os"
	"path"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	bus.AddEventListener(CleanTmpFiles)
}

func CleanTmpFiles(cmd *models.HourCommand) error {
	files, err := ioutil.ReadDir(setting.ImagesDir)

	var toDelete []os.FileInfo
	for _, file := range files {
		if file.ModTime().AddDate(0, 0, setting.RenderedImageTTLDays).Before(cmd.Time) {
			toDelete = append(toDelete, file)
		}
	}

	for _, file := range toDelete {
		fullPath := path.Join(setting.ImagesDir, file.Name())
		err := os.Remove(fullPath)
		if err != nil {
			return err
		}
	}

	tlog.Debug("Found old rendered image to delete", "deleted", len(toDelete), "keept", len(files))

	return err
}
