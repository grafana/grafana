package store

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/services/user"
)

type WriteValueWorkflow = string

var (
	WriteValueWorkflow_Save WriteValueWorkflow = "save" // or empty
	WriteValueWorkflow_PR   WriteValueWorkflow = "pr"
	WriteValueWorkflow_Push WriteValueWorkflow = "push"
)

type WriteValueRequest struct {
	User       *user.SignedInUser
	Path       string             // added from URL
	EntityType EntityType         `json:"kind,omitempty"` // for now only dashboard
	Body       json.RawMessage    `json:"body,omitempty"`
	Message    string             `json:"message,omitempty"`
	Title      string             `json:"title,omitempty"`    // For PRs
	Workflow   WriteValueWorkflow `json:"workflow,omitempty"` // save | pr | push
}

type WriteValueResponse struct {
	Code    int    `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
	URL     string `json:"url,omitempty"`
	Hash    string `json:"hash,omitempty"`
	Branch  string `json:"branch,omitempty"`
	Pending bool   `json:"pending,omitempty"`
	Size    int64  `json:"size,omitempty"`
}

type storageTree interface {
	GetFile(ctx context.Context, orgId int64, path string) (*filestorage.File, error)
	ListFolder(ctx context.Context, orgId int64, path string, accessFilter filestorage.PathFilter) (*StorageListFrame, error)
}

//-------------------------------------------
// INTERNAL
//-------------------------------------------

type storageRuntime interface {
	Meta() RootStorageMeta

	Store() filestorage.FileStorage

	Sync() error

	// Different storage knows how to handle comments and tracking
	Write(ctx context.Context, cmd *WriteValueRequest) (*WriteValueResponse, error)
}

type RootStorageMeta struct {
	ReadOnly bool          `json:"editable,omitempty"`
	Builtin  bool          `json:"builtin,omitempty"`
	Ready    bool          `json:"ready"` // can connect
	Notice   []data.Notice `json:"notice,omitempty"`

	Config RootStorageConfig `json:"config"`
}

type StorageListFrame struct {
	*data.Frame
}

const (
	titleListFrameField       = "title"
	nameListFrameField        = "name"
	descriptionListFrameField = "description"
	mediaTypeListFrameField   = "mediaType"
	sizeListFrameField        = "size"
)

func (s *StorageListFrame) GetFileNames() []string {
	var fileNames []string
	if s == nil {
		return fileNames
	}

	field, idx := s.FieldByName(nameListFrameField)
	if field.Len() == 0 || idx == -1 {
		return fileNames
	}

	for i := 0; i < field.Len(); i++ {
		if stringValue, ok := field.At(i).(string); ok {
			fileNames = append(fileNames, stringValue)
		}
	}

	return fileNames
}
