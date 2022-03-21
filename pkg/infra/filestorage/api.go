package filestorage

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/armon/go-radix"
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

type PathFilter interface {
	IsAllowed(path string) bool
	RawData() PathFilters
	And(p PathFilter) PathFilter
}

type PathFilters struct {
	allowedPrefixes    []string
	disallowedPrefixes []string
	allowedPaths       []string
	disallowedPaths    []string
	trees              *radixTrees
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

type radixTrees struct {
	allow *radix.Tree
	deny  *radix.Tree
}

func (f *PathFilters) initializeTrees() {
	allowTree := radix.New()
	denyTree := radix.New()
	for _, disallowedPrefix := range f.disallowedPrefixes {
		denyTree.Insert(disallowedPrefix, "*")
	}

	for _, disallowedPath := range f.disallowedPaths {
		denyTree.Insert(disallowedPath, "")
	}

	for _, allowedPath := range f.allowedPaths {
		isDenied := false
		denyTree.WalkPath(allowedPath, func(s string, v interface{}) bool {
			if v == "*" || s == allowedPath {
				isDenied = true
				return true
			}
			return false
		})

		if !isDenied {
			allowTree.Insert(allowedPath, "")
		}
	}

	for _, allowedPrefix := range f.allowedPrefixes {
		isDenied := false
		denyTree.WalkPath(allowedPrefix, func(s string, v interface{}) bool {
			if v == "*" {
				isDenied = true
				return true
			}
			return false
		})

		if !isDenied {
			allowTree.Insert(allowedPrefix, "*")
		}
	}

	f.trees = &radixTrees{
		allow: allowTree,
		deny:  denyTree,
	}
}

func NewPathFilters(allowedPrefixes []string, allowedPaths []string, disallowedPrefixes []string, disallowedPaths []string) *PathFilters {
	p := &PathFilters{
		allowedPrefixes:    toLower(allowedPrefixes),
		allowedPaths:       toLower(allowedPaths),
		disallowedPaths:    toLower(disallowedPaths),
		disallowedPrefixes: toLower(disallowedPrefixes),
	}

	if p.isAllowAll() || p.isDenyAll() {
		return p
	}
	p.initializeTrees()
	return p
}

func (f *PathFilters) isDenyAll() bool {
	return f.allowedPaths != nil && f.allowedPrefixes != nil && (len(f.allowedPaths)+len(f.allowedPrefixes) == 0)
}

func (f *PathFilters) isAllowAll() bool {
	return f.allowedPaths == nil && f.allowedPrefixes == nil && (len(f.disallowedPaths)+len(f.disallowedPrefixes) == 0)
}

func (f *PathFilters) IsAllowed(path string) bool {
	if f == nil {
		return true
	}

	if f.isDenyAll() {
		return false
	}

	if f.isAllowAll() {
		return true
	}

	path = strings.ToLower(path)

	denied := false
	f.trees.deny.WalkPath(path, func(s string, v interface{}) bool {
		if v == "*" || s == path {
			denied = true
			return true
		}
		return false
	})

	if denied {
		return false
	}

	allowed := false
	f.trees.allow.WalkPath(path, func(s string, v interface{}) bool {
		if v == "*" || s == path {
			allowed = true
			return true
		}
		return false
	})

	return allowed
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
