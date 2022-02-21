package filestorage

import (
	"context"
	"errors"
	"time"
)

var (
	ErrRelativePath          = errors.New("path cant be relative")
	ErrNonCanonicalPath      = errors.New("path must be canonical")
	ErrPathTooLong           = errors.New("path is too long")
	ErrPathInvalid           = errors.New("path is invalid")
	ErrPathEndsWithDelimiter = errors.New("path can not end with delimiter")
	Delimiter                = "/"
)

type File struct {
	Contents []byte
	FileMetadata
}

type FileMetadata struct {
	Name       string
	FullPath   string
	Created    time.Time
	Properties map[string]string
}

type ListFilesResponse struct {
	Files    []FileMetadata
	HasMore  bool
	LastPath string
}

type Folder struct {
	Name string
	Path string
}

type Paging struct {
	After string
	First int
}

type UpsertFileCommand struct {
	Path       string
	Contents   *[]byte
	Properties map[string]string
}

type FileStorage interface {
	Get(ctx context.Context, path string) (*File, error)
	Delete(ctx context.Context, path string) error
	Upsert(ctx context.Context, command *UpsertFileCommand) error

	ListFiles(ctx context.Context, path string, recursive bool, cursor *Paging) (*ListFilesResponse, error)
	ListFolders(ctx context.Context, path string) ([]Folder, error)

	CreateFolder(ctx context.Context, path string, folderName string) error
	DeleteFolder(ctx context.Context, path string) error
}

// Get(ctx, "/myGit/dashboards/xyz123")
// Get(ctx, "/ryansGit/dashboards/xyz124")
// Get(ctx, "/general/dashboards/xyz124")    ?? general
//   VS
// s3Storage.Get(ctx, "/dashboards/xyz123")
