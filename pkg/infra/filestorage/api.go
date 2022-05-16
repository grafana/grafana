package filestorage

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

var (
	ErrRelativePath          = errors.New("path cant be relative")
	ErrNonCanonicalPath      = errors.New("path must be canonical")
	ErrPathTooLong           = errors.New("path is too long")
	ErrPathInvalid           = errors.New("path is invalid")
	ErrPathEndsWithDelimiter = errors.New("path can not end with delimiter")
	Delimiter                = "/"
	DirectoryMimeType        = "directory"
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

func (f *File) IsFolder() bool {
	return f.MimeType == DirectoryMimeType
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

type Paging struct {
	After string
	First int
}

type UpsertFileCommand struct {
	Path               string
	MimeType           string
	CacheControl       string
	ContentDisposition string

	// Contents of an existing file won't be modified if cmd.Contents is nil
	Contents []byte
	// Properties of an existing file won't be modified if cmd.Properties is nil
	Properties map[string]string
}

func toLower(list []string) []string {
	if list == nil {
		return nil
	}
	lower := make([]string, 0)
	for _, el := range list {
		lower = append(lower, strings.ToLower(el))
	}
	return lower
}

type ListResponse struct {
	Files    []*File
	HasMore  bool
	LastPath string
}

func (r *ListResponse) String() string {
	if r == nil {
		return "Nil ListResponse"
	}

	if r.Files == nil {
		return "ListResponse with Nil files slice"
	}

	if len(r.Files) == 0 {
		return "Empty ListResponse"
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("ListResponse with %d files\n", len(r.Files)))
	for i := range r.Files {
		sb.WriteString(fmt.Sprintf("  - %s, contentsLength: %d\n", r.Files[i].FullPath, len(r.Files[i].Contents)))
	}

	sb.WriteString(fmt.Sprintf("Last path: %s, has more: %t\n", r.LastPath, r.HasMore))
	return sb.String()
}

type ListOptions struct {
	Recursive    bool
	WithFiles    bool
	WithFolders  bool
	WithContents bool
	Filter       PathFilter
}

type FileStorage interface {
	Get(ctx context.Context, path string) (*File, error)
	Delete(ctx context.Context, path string) error
	Upsert(ctx context.Context, command *UpsertFileCommand) error

	// List lists only files without content by default
	List(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListResponse, error)

	CreateFolder(ctx context.Context, path string) error
	DeleteFolder(ctx context.Context, path string) error

	close() error
}
