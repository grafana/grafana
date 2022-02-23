package filestorage

import (
	"context"
	"fmt"
	"mime"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/memblob"
)

var (
	directoryMarker = ".___gf_dir_marker___"
	pathRegex       = regexp.MustCompile("(^/$)|(^(/[A-Za-z0-9!\\-_.*'()]+)+$)")
)

type wrapper struct {
	log         log.Logger
	wrapped     FileStorage
	pathFilters *PathFilters
}

func getPath(folderPath string, name string) string {
	return fmt.Sprintf("%s%s%s", folderPath, Delimiter, name)
}

func getParentFolderPath(path string) string {
	if path == Delimiter || path == "" {
		return Delimiter
	}

	if !strings.Contains(path, Delimiter) {
		return Delimiter
	}

	split := strings.Split(path, Delimiter)
	splitWithoutLastPart := split[:len(split)-1]
	return strings.Join(splitWithoutLastPart, Delimiter)
}

func getName(path string) string {
	if path == Delimiter || path == "" {
		return ""
	}

	split := strings.Split(path, Delimiter)
	return split[len(split)-1]
}

func validatePath(path string) error {
	if !filepath.IsAbs(path) {
		return ErrRelativePath
	}

	if path == Delimiter {
		return nil
	}

	if filepath.Clean(path) != path {
		return ErrNonCanonicalPath
	}

	if strings.HasSuffix(path, Delimiter) {
		return ErrPathEndsWithDelimiter
	}

	if len(path) > 1000 {
		return ErrPathTooLong
	}

	matches := pathRegex.MatchString(path)
	if !matches {
		return ErrPathInvalid
	}

	return nil
}

func (b wrapper) Get(ctx context.Context, path string) (*File, error) {
	if err := validatePath(path); err != nil {
		return nil, err
	}

	if !b.pathFilters.isAllowed(path) {
		return nil, nil
	}

	return b.wrapped.Get(ctx, path)
}
func (b wrapper) Delete(ctx context.Context, path string) error {
	if err := validatePath(path); err != nil {
		return err
	}

	if !b.pathFilters.isAllowed(path) {
		return nil
	}

	return b.wrapped.Delete(ctx, path)
}

func detectContentType(path string, originalGuess string) string {
	if originalGuess == "application/octet-stream" || originalGuess == "" {
		mimeTypeBasedOnExt := mime.TypeByExtension(filepath.Ext(path))
		if mimeTypeBasedOnExt == "" {
			return "application/octet-stream"
		}
		return mimeTypeBasedOnExt
	}
	return originalGuess
}

func (b wrapper) Upsert(ctx context.Context, file *UpsertFileCommand) error {
	if err := validatePath(file.Path); err != nil {
		return err
	}

	if !b.pathFilters.isAllowed(file.Path) {
		return nil
	}

	if file.Contents != nil && file.MimeType == "" {
		file.MimeType = detectContentType(file.Path, "")
	}

	return b.wrapped.Upsert(ctx, file)
}

func (b wrapper) withDefaults(options *ListOptions, folderQuery bool) *ListOptions {
	if options == nil {
		options = &ListOptions{}
		options.Recursive = folderQuery
		if b.pathFilters != nil && b.pathFilters.allowedPrefixes != nil {
			options.PathFilters = *b.pathFilters
		}

		return options
	}

	if b.pathFilters != nil && b.pathFilters.allowedPrefixes != nil {
		if options.allowedPrefixes != nil {
			options.allowedPrefixes = append(options.allowedPrefixes, b.pathFilters.allowedPrefixes...)
		} else {
			copiedPrefixes := make([]string, len(b.pathFilters.allowedPrefixes))
			copy(copiedPrefixes, b.pathFilters.allowedPrefixes)
			options.allowedPrefixes = copiedPrefixes
		}
	}

	return options
}

func (b wrapper) ListFiles(ctx context.Context, path string, paging *Paging, options *ListOptions) (*ListFilesResponse, error) {
	if err := validatePath(path); err != nil {
		return nil, err
	}

	if paging == nil {
		paging = &Paging{
			First: 100,
		}
	}
	return b.wrapped.ListFiles(ctx, path, paging, b.withDefaults(options, false))
}

func (b wrapper) ListFolders(ctx context.Context, path string, options *ListOptions) ([]FileMetadata, error) {
	if err := validatePath(path); err != nil {
		return nil, err
	}

	return b.wrapped.ListFolders(ctx, path, b.withDefaults(options, true))
}

func (b wrapper) CreateFolder(ctx context.Context, path string, folderName string) error {
	fullPath := getPath(path, folderName)
	if err := validatePath(fullPath); err != nil {
		return err
	}

	if !b.pathFilters.isAllowed(fullPath) {
		return nil
	}

	return b.wrapped.CreateFolder(ctx, path, folderName)
}

func (b wrapper) DeleteFolder(ctx context.Context, path string) error {
	if err := validatePath(path); err != nil {
		return err
	}

	if !b.pathFilters.isAllowed(path) {
		return nil
	}

	filesInFolder, err := b.ListFiles(ctx, path, &Paging{First: 1}, &ListOptions{Recursive: true})
	if err != nil {
		return err
	}

	if len(filesInFolder.Files) > 0 {
		return fmt.Errorf("folder %s is not empty - cant remove it", path)
	}

	return b.wrapped.DeleteFolder(ctx, path)
}

func (c wrapper) close() error {
	return c.wrapped.close()
}
