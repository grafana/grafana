package stores

import (
	"encoding/json"
	log "github.com/alecthomas/log4go"
	"github.com/torkelo/grafana-pro/backend/models"
	"io"
	"os"
	"path/filepath"
)

type fileStore struct {
	dataDir string
	dashDir string
}

func NewFileStore(dataDir string) *fileStore {

	if dirDoesNotExist(dataDir) {
		log.Crashf("FileStore failed to initialize, dataDir does not exist %v", dataDir)
	}

	dashDir := filepath.Join(dataDir, "dashboards")

	if dirDoesNotExist(dashDir) {
		log.Debug("Did not find dashboard dir, creating...")
		err := os.Mkdir(dashDir, 0777)
		if err != nil {
			log.Crashf("FileStore failed to initialize, could not create directory %v, error: %v", dashDir, err)
		}
	}

	return &fileStore{
		dataDir: dataDir,
		dashDir: dashDir,
	}
}

func (store *fileStore) GetById(id string) (*models.Dashboard, error) {
	filename := store.getFilePathForDashboard(id)

	log.Debug("Opening dashboard file %v", filename)

	configFile, err := os.Open(filename)
	if err != nil {
		return nil, err
	}

	return models.NewFromJson(configFile)
}

func (store *fileStore) Save(dash *models.Dashboard) error {
	filename := store.getFilePathForDashboard(dash.Title())

	log.Debug("Saving dashboard %v to %v", dash.Title(), filename)

	var err error
	var data []byte
	if data, err = json.Marshal(dash); err != nil {
		return err
	}

	return writeFile(filename, data)
}

func (store *fileStore) getFilePathForDashboard(id string) string {
	return filepath.Join(store.dashDir, id) + ".json"
}

func dirDoesNotExist(dir string) bool {
	_, err := os.Stat(dir)
	return os.IsNotExist(err)
}

func writeFile(filename string, data []byte) error {
	f, err := os.OpenFile(filename, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0666)
	if err != nil {
		return err
	}
	n, err := f.Write(data)
	if err == nil && n < len(data) {
		err = io.ErrShortWrite
	}
	if err1 := f.Close(); err == nil {
		err = err1
	}

	return err
}
