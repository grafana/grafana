package stores

//
// import (
// 	"encoding/json"
// 	"io"
// 	"os"
// 	"path/filepath"
// 	"strings"
//
// 	log "github.com/alecthomas/log4go"
// 	"github.com/torkelo/grafana-pro/pkg/models"
// )
//
// type fileStore struct {
// 	dataDir string
// 	dashDir string
// 	cache   map[string]*models.Dashboard
// }
//
// func NewFileStore(dataDir string) *fileStore {
//
// 	if dirDoesNotExist(dataDir) {
// 		log.Crashf("FileStore failed to initialize, dataDir does not exist %v", dataDir)
// 	}
//
// 	dashDir := filepath.Join(dataDir, "dashboards")
//
// 	if dirDoesNotExist(dashDir) {
// 		log.Debug("Did not find dashboard dir, creating...")
// 		err := os.Mkdir(dashDir, 0777)
// 		if err != nil {
// 			log.Crashf("FileStore failed to initialize, could not create directory %v, error: %v", dashDir, err)
// 		}
// 	}
//
// 	store := &fileStore{}
// 	store.dataDir = dataDir
// 	store.dashDir = dashDir
// 	store.cache = make(map[string]*models.Dashboard)
// 	store.scanFiles()
//
// 	return store
// }
//
// func (store *fileStore) scanFiles() {
// 	visitor := func(path string, f os.FileInfo, err error) error {
// 		if err != nil {
// 			return err
// 		}
// 		if f.IsDir() {
// 			return nil
// 		}
// 		if strings.HasSuffix(f.Name(), ".json") {
// 			err = store.loadDashboardIntoCache(path)
// 			if err != nil {
// 				return err
// 			}
// 		}
// 		return nil
// 	}
//
// 	err := filepath.Walk(store.dashDir, visitor)
// 	if err != nil {
// 		log.Error("FileStore::updateCache failed %v", err)
// 	}
// }
//
// func (store fileStore) loadDashboardIntoCache(filename string) error {
// 	log.Info("Loading dashboard file %v into cache", filename)
// 	dash, err := loadDashboardFromFile(filename)
// 	if err != nil {
// 		return err
// 	}
//
// 	store.cache[dash.Title] = dash
//
// 	return nil
// }
//
// func (store *fileStore) Close() {
//
// }
//
// func (store *fileStore) GetById(id string) (*models.Dashboard, error) {
// 	log.Debug("FileStore::GetById id = %v", id)
// 	filename := store.getFilePathForDashboard(id)
//
// 	return loadDashboardFromFile(filename)
// }
//
// func (store *fileStore) Save(dash *models.Dashboard) error {
// 	filename := store.getFilePathForDashboard(dash.Title)
//
// 	log.Debug("Saving dashboard %v to %v", dash.Title, filename)
//
// 	var err error
// 	var data []byte
// 	if data, err = json.Marshal(dash.Data); err != nil {
// 		return err
// 	}
//
// 	return writeFile(filename, data)
// }
//
// func (store *fileStore) Query(query string) ([]*models.SearchResult, error) {
// 	results := make([]*models.SearchResult, 0, 50)
//
// 	for _, dash := range store.cache {
// 		item := &models.SearchResult{
// 			Id:   dash.Title,
// 			Type: "dashboard",
// 		}
// 		results = append(results, item)
// 	}
//
// 	return results, nil
// }
//
// func loadDashboardFromFile(filename string) (*models.Dashboard, error) {
// 	log.Debug("FileStore::loading dashboard from file %v", filename)
//
// 	configFile, err := os.Open(filename)
// 	if err != nil {
// 		return nil, err
// 	}
//
// 	return models.NewFromJson(configFile)
// }
//
// func (store *fileStore) getFilePathForDashboard(id string) string {
// 	id = strings.ToLower(id)
// 	id = strings.Replace(id, " ", "-", -1)
// 	return filepath.Join(store.dashDir, id) + ".json"
// }
//
// func dirDoesNotExist(dir string) bool {
// 	_, err := os.Stat(dir)
// 	return os.IsNotExist(err)
// }
//
// func writeFile(filename string, data []byte) error {
// 	f, err := os.OpenFile(filename, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0666)
// 	if err != nil {
// 		return err
// 	}
// 	n, err := f.Write(data)
// 	if err == nil && n < len(data) {
// 		err = io.ErrShortWrite
// 	}
// 	if err1 := f.Close(); err == nil {
// 		err = err1
// 	}
//
// 	return err
// }
