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
	pathRegex       = regexp.MustCompile(`(^/$)|(^(/[A-Za-z0-9!\-_.*'()]+)+$)`)
)

type wrapper struct {
	log         log.Logger
	wrapped     FileStorage
	pathFilters *PathFilters
}

var (
	_ FileStorage = (*wrapper)(nil) // wrapper implements FileStorage
)

func getParentFolderPath(path string) string {
	if path == Delimiter || path == "" {
		return Delimiter
	}

	path = strings.TrimSuffix(path, Delimiter)

	if !strings.Contains(path, Delimiter) {
		return Delimiter
	}

	split := strings.Split(path, Delimiter)
	splitWithoutLastPart := split[:len(split)-1]
	if len(splitWithoutLastPart) == 1 && split[0] == "" {
		return Delimiter
	}
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

func (b wrapper) validatePath(path string) error {
	if err := validatePath(path); err != nil {
		b.log.Error("Path failed validation", "path", path, "error", err)
		return err
	}
	return nil
}

func (b wrapper) Get(ctx context.Context, path string) (*File, error) {
	if err := b.validatePath(path); err != nil {
		return nil, err
	}

	if !b.pathFilters.IsAllowed(path) {
		return nil, nil
	}

	return b.wrapped.Get(ctx, path)
}
func (b wrapper) Delete(ctx context.Context, path string) error {
	if err := b.validatePath(path); err != nil {
		return err
	}

	if !b.pathFilters.IsAllowed(path) {
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
	if err := b.validatePath(file.Path); err != nil {
		return err
	}

	if !b.pathFilters.IsAllowed(file.Path) {
		return nil
	}

	path := getParentFolderPath(file.Path)
	b.log.Info("Creating folder before upserting file", "file", file.Path, "folder", path)
	if err := b.CreateFolder(ctx, path); err != nil {
		return err
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
		if b.pathFilters != nil {
			options.PathFilters = b.pathFilters
		}

		return options
	}

	if options.PathFilters == nil {
		if b.pathFilters != nil {
			options.PathFilters = b.pathFilters
		} else {
			options.PathFilters = allowAllPathFilters()
		}
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

	if b.pathFilters != nil && b.pathFilters.allowedPaths != nil {
		if options.allowedPaths != nil {
			options.allowedPaths = append(options.allowedPaths, b.pathFilters.allowedPaths...)
		} else {
			copiedPaths := make([]string, len(b.pathFilters.allowedPaths))
			copy(copiedPaths, b.pathFilters.allowedPaths)
			options.allowedPaths = copiedPaths
		}
	}

	if b.pathFilters != nil && b.pathFilters.disallowedPrefixes != nil {
		if options.disallowedPrefixes != nil {
			options.disallowedPrefixes = append(options.disallowedPrefixes, b.pathFilters.disallowedPrefixes...)
		} else {
			copiedPrefixes := make([]string, len(b.pathFilters.disallowedPrefixes))
			copy(copiedPrefixes, b.pathFilters.disallowedPrefixes)
			options.disallowedPrefixes = copiedPrefixes
		}
	}

	if b.pathFilters != nil && b.pathFilters.disallowedPaths != nil {
		if options.disallowedPaths != nil {
			options.disallowedPaths = append(options.disallowedPaths, b.pathFilters.disallowedPaths...)
		} else {
			copiedPaths := make([]string, len(b.pathFilters.disallowedPaths))
			copy(copiedPaths, b.pathFilters.disallowedPaths)
			options.disallowedPaths = copiedPaths
		}
	}

	return options
}

func (b wrapper) ListFiles(ctx context.Context, path string, paging *Paging, options *ListOptions) (*ListFilesResponse, error) {
	if err := b.validatePath(path); err != nil {
		return nil, err
	}

	if paging == nil {
		paging = &Paging{
			First: 100,
		}
	} else if paging.First <= 0 {
		paging.First = 100
	}

	resp, err := b.wrapped.ListFiles(ctx, path, paging, b.withDefaults(options, false))
	if err != nil {
		return resp, err
	}

	if len(resp.Files) != 0 {
		return resp, err
	}

	// TODO: optimize, don't fetch the contents in this case
	file, err := b.Get(ctx, path)
	if err != nil {
		return resp, err
	}

	if file != nil {
		return &ListFilesResponse{
			Files:    []FileMetadata{file.FileMetadata},
			HasMore:  false,
			LastPath: file.FileMetadata.FullPath,
		}, nil
	}

	return resp, err
}

func (b wrapper) ListFolders(ctx context.Context, path string, options *ListOptions) ([]FileMetadata, error) {
	if err := b.validatePath(path); err != nil {
		return nil, err
	}

	return b.wrapped.ListFolders(ctx, path, b.withDefaults(options, true))
}

func (b wrapper) CreateFolder(ctx context.Context, path string) error {
	if err := b.validatePath(path); err != nil {
		return err
	}

	if !b.pathFilters.IsAllowed(path) {
		return nil
	}

	return b.wrapped.CreateFolder(ctx, path)
}

func (b wrapper) DeleteFolder(ctx context.Context, path string) error {
	if err := b.validatePath(path); err != nil {
		return err
	}

	if !b.pathFilters.IsAllowed(path) {
		return nil
	}

	isEmpty, err := b.isFolderEmpty(ctx, path)
	if err != nil {
		return err
	}

	if !isEmpty {
		return fmt.Errorf("folder %s is not empty - cant remove it", path)
	}

	return b.wrapped.DeleteFolder(ctx, path)
}

func (b wrapper) isFolderEmpty(ctx context.Context, path string) (bool, error) {
	filesInFolder, err := b.ListFiles(ctx, path, &Paging{First: 1}, &ListOptions{Recursive: true})
	if err != nil {
		return false, err
	}

	if len(filesInFolder.Files) > 0 {
		return false, nil
	}

	folders, err := b.ListFolders(ctx, path, &ListOptions{
		Recursive: true,
	})
	if err != nil {
		return false, err
	}

	if len(folders) > 0 {
		return false, nil
	}

	return true, nil
}

func (b wrapper) close() error {
	return b.wrapped.close()
}
