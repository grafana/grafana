package store

type RootStorageConfig struct {
	Type   string `json:"type"`
	Prefix string `json:"prefix"`
	Name   string `json:"name"`

	// Depending on type, these will be configured
	Disk *StorageLocalDiskConfig `json:"disk,omitempty"`
	Git  *StorageGitConfig       `json:"git,omitempty"`
	SQL  *StorageSQLConfig       `json:"sql,omitempty"`
	S3   *StorageS3Config        `json:"s3,omitempty"`
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

	// SECURE JSON :grimicing:
	AccessToken string `json:"accessToken,omitempty"` // Simplest auth method for github
}

type StorageSQLConfig struct {
	// no custom settings
}

type StorageS3Config struct {
	Bucket string `json:"bucket"`
}

type StorageConfig struct {
	Dashboard  []RootStorageConfig `json:"dashboard"`
	DataSource []RootStorageConfig `json:"datasource"`
	Resource   []RootStorageConfig `json:"resource"`
}
