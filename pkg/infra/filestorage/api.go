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
	Files      []FileMetadata
	HasMore    bool
	LastPath   string
	TotalCount int
}

type Folder struct {
	Name string
	Path string
}

type Cursor struct {
	AfterPath string
	First     int
}

type UpsertFileCommand struct {
	Path       string
	Contents   *[]byte
	Properties map[string]string
}

type FileStorage interface {
	Get(ctx context.Context, filePath string) (*File, error)
	Delete(ctx context.Context, filePath string) error
	Upsert(ctx context.Context, command *UpsertFileCommand) error

	ListFiles(ctx context.Context, folderPath string, recursive bool, cursor *Cursor) (*ListFilesResponse, error)
	ListFolders(ctx context.Context, parentFolderPath string) (*[]Folder, error)

	CreateFolder(ctx context.Context, parentFolderPath string, folderName string) error
	DeleteFolder(ctx context.Context, folderPath string) error
}
