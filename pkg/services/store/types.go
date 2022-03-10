package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/models"
)

type SaveDashboardRequest struct {
	Path    string
	User    *models.SignedInUser
	Body    json.RawMessage // []byte
	Message string
}

type storageTree interface {
	// Called from the UI when a dashboard is saved
	GetFile(ctx context.Context, path string) (*filestorage.File, error)

	// Get a single dashboard
	ListFolder(ctx context.Context, path string) (*data.Frame, error)
}

//-------------------------------------------
// INTERNAL
//-------------------------------------------

type writeCommand struct {
	Path    string
	Body    []byte
	User    *models.SignedInUser
	Message string
}

type storageRuntime interface {
	Meta() RootStorageMeta

	Store() filestorage.FileStorage

	// Different storage knows how to handle comments and tracking
	Write(ctx context.Context, cmd *writeCommand) error
}

type baseStorageRuntime struct {
	meta  RootStorageMeta
	store filestorage.FileStorage
}

func (t *baseStorageRuntime) Meta() RootStorageMeta {
	return t.meta
}

func (t *baseStorageRuntime) Store() filestorage.FileStorage {
	return t.store
}

func (t *baseStorageRuntime) Write(ctx context.Context, cmd *writeCommand) error {
	return fmt.Errorf("unsupportted operation") // will be overridden
}

func (t *baseStorageRuntime) setReadOnly(val bool) *baseStorageRuntime {
	t.meta.ReadOnly = val
	return t
}

func (t *baseStorageRuntime) setBuiltin(val bool) *baseStorageRuntime {
	t.meta.Builtin = val
	return t
}

// TEMPORARY! internally, used for listing and building an index
type DashboardQueryResultForSearchIndex struct {
	Id       int64
	IsFolder bool   `xorm:"is_folder"`
	FolderID int64  `xorm:"folder_id"`
	Slug     string `xorm:"slug"` // path when GIT/ETC
	Data     []byte
	Created  time.Time
	Updated  time.Time
}

type DashboardBodyIterator func() *DashboardQueryResultForSearchIndex

type RootStorageMeta struct {
	ReadOnly bool          `json:"editable,omitempty"`
	Builtin  bool          `json:"builtin,omitempty"`
	Ready    bool          `json:"ready"` // can connect
	Notice   []data.Notice `json:"notice,omitempty"`

	Config RootStorageConfig `json:"config"`
}
