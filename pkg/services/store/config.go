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
	// SQLStorage will prefix all paths with orgId for isolation between orgs
	orgId int64
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
