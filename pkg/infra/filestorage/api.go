package filestorage

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
)

type Operation string

const (
	OperationGet          Operation = "get"
	OperationDelete       Operation = "delete"
	OperationUpsert       Operation = "upsert"
	OperationListFiles    Operation = "listFiles"
	OperationListFolders  Operation = "listFolders"
	OperationCreateFolder Operation = "createFolder"
	OperationDeleteFolder Operation = "deleteFolder"
)

var (
	ErrRelativePath          = errors.New("path cant be relative")
	ErrNonCanonicalPath      = errors.New("path must be canonical")
	ErrPathTooLong           = errors.New("path is too long")
	ErrPathInvalid           = errors.New("path is invalid")
	ErrPathEndsWithDelimiter = errors.New("path can not end with delimiter")
	ErrOperationNotSupported = errors.New("operation not supported")
	Delimiter                = "/"
	multipleDelimiters       = regexp.MustCompile(`/+`)
)

func Join(parts ...string) string {
	joinedPath := Delimiter + strings.Join(parts, Delimiter)

	// makes the API more forgiving for clients without compromising safety
	return multipleDelimiters.ReplaceAllString(joinedPath, Delimiter)
}

type File struct {
	Contents []byte
	FileMetadata
}

type FileMetadata struct {
	Name       string
	FullPath   string
	MimeType   string
	Modified   time.Time
	Created    time.Time
	Size       int64
	Properties map[string]string
}

type ListFilesResponse struct {
	Files    []FileMetadata
	HasMore  bool
	LastPath string
}

type Paging struct {
	After string
	First int
}

type UpsertFileCommand struct {
	Path       string
	MimeType   string
	Contents   *[]byte
	Properties map[string]string
}

type PathFilters struct {
	allowedPrefixes []string
}

func (f *PathFilters) isAllowed(path string) bool {
	if f == nil || f.allowedPrefixes == nil {
		return true
	}

	for i := range f.allowedPrefixes {
		if strings.HasPrefix(path, strings.ToLower(f.allowedPrefixes[i])) {
			return true
		}
	}

	return false
}

type ListOptions struct {
	Recursive bool
	PathFilters
}

type FileStorage interface {
	Get(ctx context.Context, path string) (*File, error)
	Delete(ctx context.Context, path string) error
	Upsert(ctx context.Context, command *UpsertFileCommand) error

	ListFiles(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListFilesResponse, error)
	ListFolders(ctx context.Context, folderPath string, options *ListOptions) ([]FileMetadata, error)

	CreateFolder(ctx context.Context, path string) error
	DeleteFolder(ctx context.Context, path string) error

	close() error
}
