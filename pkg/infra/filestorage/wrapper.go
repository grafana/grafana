package filestorage

import (
	"context"
	"fmt"
	"mime"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
)

var (
	directoryMarker = ".___gf_dir_marker___"
	pathRegex       = regexp.MustCompile(`(^/$)|(^(/[A-Za-z0-9!\-_.*'() ]+)+$)`)
)

type wrapper struct {
	log         log.Logger
	wrapped     FileStorage
	pathFilters *PathFilters
	rootFolder  string
}

func addRootFolderToFilters(pathFilters *PathFilters, rootFolder string) *PathFilters {
	if pathFilters == nil {
		return pathFilters
	}

	for i := range pathFilters.disallowedPaths {
		pathFilters.disallowedPaths[i] = rootFolder + strings.TrimPrefix(pathFilters.disallowedPaths[i], Delimiter)
	}
	for i := range pathFilters.disallowedPrefixes {
		pathFilters.disallowedPrefixes[i] = rootFolder + strings.TrimPrefix(pathFilters.disallowedPrefixes[i], Delimiter)
	}
	for i := range pathFilters.allowedPaths {
		pathFilters.allowedPaths[i] = rootFolder + strings.TrimPrefix(pathFilters.allowedPaths[i], Delimiter)
	}
	for i := range pathFilters.allowedPrefixes {
		pathFilters.allowedPrefixes[i] = rootFolder + strings.TrimPrefix(pathFilters.allowedPrefixes[i], Delimiter)
	}

	return pathFilters
}

func copyPathFilters(p *PathFilters) *PathFilters {
	if p == nil {
		return nil
	}

	return NewPathFilters(p.allowedPrefixes, p.allowedPaths, p.disallowedPrefixes, p.disallowedPaths)
}

func addPathFilters(base *PathFilters, new *PathFilters) *PathFilters {
	if new == nil {
		return base
	}

	if new.allowedPrefixes != nil {
		if base.allowedPrefixes != nil {
			base.allowedPrefixes = append(base.allowedPrefixes, new.allowedPrefixes...)
		} else {
			copiedPrefixes := make([]string, len(new.allowedPrefixes))
			copy(copiedPrefixes, new.allowedPrefixes)
			base.allowedPrefixes = copiedPrefixes
		}
	}

	if new.allowedPaths != nil {
		if base.allowedPaths != nil {
			base.allowedPaths = append(base.allowedPaths, new.allowedPaths...)
		} else {
			copiedPaths := make([]string, len(new.allowedPaths))
			copy(copiedPaths, new.allowedPaths)
			base.allowedPaths = copiedPaths
		}
	}

	if new.disallowedPrefixes != nil {
		if base.disallowedPrefixes != nil {
			base.disallowedPrefixes = append(base.disallowedPrefixes, new.disallowedPrefixes...)
		} else {
			copiedPrefixes := make([]string, len(new.disallowedPrefixes))
			copy(copiedPrefixes, new.disallowedPrefixes)
			base.disallowedPrefixes = copiedPrefixes
		}
	}

	if new.disallowedPaths != nil {
		if base.disallowedPaths != nil {
			base.disallowedPaths = append(base.disallowedPaths, new.disallowedPaths...)
		} else {
			copiedPaths := make([]string, len(new.disallowedPaths))
			copy(copiedPaths, new.disallowedPaths)
			base.disallowedPaths = copiedPaths
		}
	}

	return base
}

func newWrapper(log log.Logger, wrapped FileStorage, pathFilters *PathFilters, rootFolder string) FileStorage {
	var rootedPathFilters *PathFilters
	if pathFilters != nil {
		rootedPathFilters = addRootFolderToFilters(copyPathFilters(pathFilters), rootFolder)
	} else {
		rootedPathFilters = allowAllPathFilters()
	}

	return &wrapper{
		log:         log,
		wrapped:     wrapped,
		pathFilters: rootedPathFilters,
		rootFolder:  rootFolder,
	}
}

var (
	_ FileStorage = (*wrapper)(nil) // wrapper implements FileStorage
)

func getParentFolderPath(path string) string {
	if path == Delimiter || path == "" {
		return path
	}

	if !strings.Contains(path, Delimiter) {
		return ""
	}

	path = strings.TrimSuffix(path, Delimiter)
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

func (b wrapper) addRoot(path string) string {
	return b.rootFolder + strings.TrimPrefix(path, Delimiter)
}

func (b wrapper) removeRoot(path string) string {
	return Join(Delimiter, strings.TrimPrefix(path, b.rootFolder))
}

func (b wrapper) Get(ctx context.Context, path string) (*File, error) {
	if err := b.validatePath(path); err != nil {
		return nil, err
	}

	rootedPath := b.addRoot(path)
	if !b.pathFilters.IsAllowed(rootedPath) {
		return nil, nil
	}

	file, err := b.wrapped.Get(ctx, rootedPath)
	if file != nil {
		file.FullPath = b.removeRoot(file.FullPath)
	}
	return file, err
}
func (b wrapper) Delete(ctx context.Context, path string) error {
	if err := b.validatePath(path); err != nil {
		return err
	}

	rootedPath := b.addRoot(path)
	if !b.pathFilters.IsAllowed(rootedPath) {
		return nil
	}

	return b.wrapped.Delete(ctx, rootedPath)
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

	rootedPath := b.addRoot(file.Path)
	if !b.pathFilters.IsAllowed(rootedPath) {
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

	return b.wrapped.Upsert(ctx, &UpsertFileCommand{
		Path:       rootedPath,
		MimeType:   file.MimeType,
		Contents:   file.Contents,
		Properties: file.Properties,
	})
}

func (b wrapper) pagingOptionsWithDefaults(paging *Paging) *Paging {
	if paging == nil {
		return &Paging{
			First: 100,
		}
	}

	if paging.First <= 0 {
		paging.First = 100
	}
	if paging.After != "" {
		paging.After = b.addRoot(paging.After)
	}
	return paging
}

func (b wrapper) listOptionsWithDefaults(options *ListOptions, folderQuery bool) *ListOptions {
	if options == nil {
		options = &ListOptions{}
		options.Recursive = folderQuery
		options.PathFilters = b.pathFilters

		return &ListOptions{
			Recursive:   folderQuery,
			PathFilters: b.pathFilters,
		}
	}

	if options.PathFilters == nil {
		return &ListOptions{
			Recursive:   options.Recursive,
			PathFilters: b.pathFilters,
		}
	}

	rootedFilters := addRootFolderToFilters(copyPathFilters(options.PathFilters), b.rootFolder)
	return &ListOptions{
		Recursive:   options.Recursive,
		PathFilters: addPathFilters(rootedFilters, b.pathFilters),
	}
}

func (b wrapper) ListFiles(ctx context.Context, path string, paging *Paging, options *ListOptions) (*ListFilesResponse, error) {
	if err := b.validatePath(path); err != nil {
		return nil, err
	}

	pathWithRoot := b.addRoot(path)
	resp, err := b.wrapped.ListFiles(ctx, pathWithRoot, b.pagingOptionsWithDefaults(paging), b.listOptionsWithDefaults(options, false))

	if resp != nil && resp.Files != nil {
		if resp.LastPath != "" {
			resp.LastPath = b.removeRoot(resp.LastPath)
		}

		for i := 0; i < len(resp.Files); i++ {
			resp.Files[i].FullPath = b.removeRoot(resp.Files[i].FullPath)
		}
	}

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
		file.FileMetadata.FullPath = b.removeRoot(file.FileMetadata.FullPath)
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

	folders, err := b.wrapped.ListFolders(ctx, b.addRoot(path), b.listOptionsWithDefaults(options, true))
	if folders != nil {
		for i := 0; i < len(folders); i++ {
			folders[i].FullPath = b.removeRoot(folders[i].FullPath)
		}
	}
	return folders, err
}

func (b wrapper) CreateFolder(ctx context.Context, path string) error {
	if err := b.validatePath(path); err != nil {
		return err
	}

	rootedPath := b.addRoot(path)
	if !b.pathFilters.IsAllowed(rootedPath) {
		return nil
	}

	return b.wrapped.CreateFolder(ctx, rootedPath)
}

func (b wrapper) DeleteFolder(ctx context.Context, path string) error {
	if err := b.validatePath(path); err != nil {
		return err
	}

	rootedPath := b.addRoot(path)
	if !b.pathFilters.IsAllowed(rootedPath) {
		return nil
	}

	isEmpty, err := b.isFolderEmpty(ctx, path)
	if err != nil {
		return err
	}

	if !isEmpty {
		return fmt.Errorf("folder %s is not empty - cant remove it", path)
	}

	return b.wrapped.DeleteFolder(ctx, rootedPath)
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
