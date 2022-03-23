package filestorage

import (
	"context"
	"errors"
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
	Path       string
	MimeType   string
	Contents   *[]byte
	Properties map[string]string
}

type PathFilters struct {
	allowedPrefixes    []string
	disallowedPrefixes []string
	allowedPaths       []string
	disallowedPaths    []string
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

func allowAllPathFilters() *PathFilters {
	return NewPathFilters(nil, nil, nil, nil)
}

//nolint:deadcode,unused
func denyAllPathFilters() *PathFilters {
	return NewPathFilters([]string{}, []string{}, nil, nil)
}

func NewPathFilters(allowedPrefixes []string, allowedPaths []string, disallowedPrefixes []string, disallowedPaths []string) *PathFilters {
	return &PathFilters{
		allowedPrefixes:    toLower(allowedPrefixes),
		allowedPaths:       toLower(allowedPaths),
		disallowedPaths:    toLower(disallowedPaths),
		disallowedPrefixes: toLower(disallowedPrefixes),
	}
}

func (f *PathFilters) isDenyAll() bool {
	return f.allowedPaths != nil && f.allowedPrefixes != nil && (len(f.allowedPaths)+len(f.allowedPrefixes) == 0)
}

func (f *PathFilters) IsAllowed(path string) bool {
	if f == nil {
		return true
	}

	path = strings.ToLower(path)
	for i := range f.disallowedPaths {
		if f.disallowedPaths[i] == path {
			return false
		}
	}

	for i := range f.disallowedPrefixes {
		if strings.HasPrefix(path, f.disallowedPrefixes[i]) {
			return false
		}
	}

	if f.allowedPrefixes == nil && f.allowedPaths == nil {
		return true
	}

	for i := range f.allowedPaths {
		if f.allowedPaths[i] == path {
			return true
		}
	}
	for i := range f.allowedPrefixes {
		if strings.HasPrefix(path, f.allowedPrefixes[i]) {
			return true
		}
	}
	return false
}

type ListResponse struct {
	Files    []*File
	HasMore  bool
	LastPath string
}

type ListOptions struct {
	Recursive    bool
	WithFiles    bool
	WithFolders  bool
	WithContents bool
	*PathFilters
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
