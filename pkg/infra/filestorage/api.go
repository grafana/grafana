package filestorage

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var (
	ErrRelativePath          = errors.New("path cant be relative")
	ErrNonCanonicalPath      = errors.New("path must be canonical")
	ErrPathTooLong           = errors.New("path is too long")
	ErrInvalidCharacters     = errors.New("path contains unsupported characters")
	ErrPathEndsWithDelimiter = errors.New("path can not end with delimiter")
	ErrPathPartTooLong       = errors.New("path part is too long")
	ErrEmptyPathPart         = errors.New("path can not have empty parts")
	Delimiter                = "/"
	DirectoryMimeType        = "directory"
	multipleDelimiters       = regexp.MustCompile(`/+`)
	pathRegex                = regexp.MustCompile(`(^/$)|(^(/[A-Za-z\d!\-_.*'() ]+)+$)`)
	maxPathLength            = 1024
	maxPathPartLength        = 256
)

func ValidatePath(path string) error {
	if !strings.HasPrefix(path, Delimiter) {
		return ErrRelativePath
	}

	if path == Delimiter {
		return nil
	}

	if strings.HasSuffix(path, Delimiter) {
		return ErrPathEndsWithDelimiter
	}

	// apply `ToSlash` to replace OS-specific separators introduced by the Clean() function
	if filepath.ToSlash(filepath.Clean(path)) != path {
		return ErrNonCanonicalPath
	}

	if len(path) > maxPathLength {
		return ErrPathTooLong
	}

	for _, part := range strings.Split(strings.TrimPrefix(path, Delimiter), Delimiter) {
		if strings.TrimSpace(part) == "" {
			return ErrEmptyPathPart
		}

		if len(part) > maxPathPartLength {
			return ErrPathPartTooLong
		}
	}

	matches := pathRegex.MatchString(path)
	if !matches {
		return ErrInvalidCharacters
	}

	return nil
}

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

type DeleteFolderOptions struct {
	// Force if set to true, the `deleteFolder` operation will delete the selected folder together with all the nested files & folders
	Force bool

	// AccessFilter must match all the nested files & folders in order for the `deleteFolder` operation to succeed
	// The access check is not performed if `AccessFilter` is nil
	AccessFilter PathFilter
}

type GetFileOptions struct {
	// WithContents if set to false, the `Get` operation will return just the file metadata. Default is `true`
	WithContents bool
}

//go:generate mockery --name FileStorage --structname MockFileStorage --inpackage --filename file_storage_mock.go
type FileStorage interface {
	Get(ctx context.Context, path string, options *GetFileOptions) (*File, bool, error)
	Delete(ctx context.Context, path string) error
	Upsert(ctx context.Context, command *UpsertFileCommand) error

	// List lists only files without content by default
	List(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListResponse, error)

	CreateFolder(ctx context.Context, path string) error
	DeleteFolder(ctx context.Context, path string, options *DeleteFolderOptions) error

	close() error
}
