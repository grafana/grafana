package store

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/setting"
)

// For now this file is stored in $GRAFANA_HOME/conf/storage.json and updated from the UI
type GlobalStorageConfig struct {
	filepath string // Local file path

	// Add dev environment
	AddDevEnv bool `json:"addDevEnv"`

	// Paths under 'root' (NOTE: this is applied to all orgs)
	Roots []RootStorageConfig `json:"roots,omitempty"`
}

func LoadStorageConfig(cfg *setting.Cfg) (*GlobalStorageConfig, error) {
	fpath := filepath.Join(cfg.HomePath, "conf", "storage.json")
	g := &GlobalStorageConfig{}
	if _, err := os.Stat(fpath); err == nil {
		body, err := ioutil.ReadFile(fpath)
		if err != nil {
			return g, err
		}
		err = json.Unmarshal(body, g)
		if err != nil {
			return g, err
		}
	}
	g.filepath = fpath
	return g, nil
}

func (c *GlobalStorageConfig) save() error {

	return nil
}

type RootStorageConfig struct {
	Type        string `json:"type"`
	Prefix      string `json:"prefix"`
	Name        string `json:"name"`
	Description string `json:"description"`

	// Depending on type, these will be configured
	Disk *StorageLocalDiskConfig `json:"disk,omitempty"`
	Git  *StorageGitConfig       `json:"git,omitempty"`
	SQL  *StorageSQLConfig       `json:"sql,omitempty"`
	S3   *StorageS3Config        `json:"s3,omitempty"`
	GCS  *StorageGCSConfig       `json:"gcs,omitempty"`
}

type StorageLocalDiskConfig struct {
	Path  string   `json:"path"`
	Roots []string `json:"roots,omitempty"` // null is everything
}

type StorageGitConfig struct {
	Remote string `json:"remote"`
	Branch string `json:"branch"`
	Root   string `json:"root"` // subfolder within the remote

	// Pull interval?
	// Requires pull request?
	RequirePullRequest bool `json:"requirePullRequest"`

	// SECURE JSON :grimicing:
	AccessToken string `json:"accessToken,omitempty"` // Simplest auth method for github
}

type StorageSQLConfig struct {
	// Internally SQL storage will have orgId prefixes
}

type StorageS3Config struct {
	Bucket string `json:"bucket"`
	Folder string `json:"folder"`

	// SECURE!!!
	AccessKey string `json:"accessKey"`
	SecretKey string `json:"secretKey"`
	Region    string `json:"region"`
}

type StorageGCSConfig struct {
	Bucket string `json:"bucket"`
	Folder string `json:"folder"`

	CredentialsFile string `json:"credentialsFile"`
}

func newStorage(cfg RootStorageConfig, localWorkCache string) (storageRuntime, error) {
	switch cfg.Type {
	case rootStorageTypeDisk:
		return newDiskStorage(cfg), nil
	case rootStorageTypeGit:
		return newGitStorage(cfg, localWorkCache), nil
	}

	return nil, fmt.Errorf("unsupported store: " + cfg.Type)
}
