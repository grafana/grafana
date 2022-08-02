package filestorage

import (
	"context"
	"fmt"
	"mime"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var (
	directoryMarker = ".___gf_dir_marker___"
)

type wrapper struct {
	log        log.Logger
	wrapped    FileStorage
	filter     PathFilter
	rootFolder string
}

func wrapPathFilter(filter PathFilter, rootFolder string) PathFilter {
	return &wrappedPathFilter{filter: filter, rootFolder: rootFolder}
}

type wrappedPathFilter struct {
	rootFolder string
	filter     PathFilter
}

func (w wrappedPathFilter) IsAllowed(path string) bool {
	pathWithReplacedRoot := Delimiter + strings.TrimPrefix(path, w.rootFolder)
	return w.filter.IsAllowed(pathWithReplacedRoot)
}

func (w wrappedPathFilter) ToString() string {
	return w.filter.ToString()
}

func (w wrappedPathFilter) asSQLFilter() accesscontrol.SQLFilter {
	sqlFilter := w.filter.asSQLFilter()
	for i := range sqlFilter.Args {
		if path, ok := sqlFilter.Args[i].(string); ok {
			sqlFilter.Args[i] = w.rootFolder + strings.TrimPrefix(path, Delimiter)
		}
	}

	return sqlFilter
}

func newWrapper(log log.Logger, wrapped FileStorage, pathFilter PathFilter, rootFolder string) FileStorage {
	var wrappedPathFilter PathFilter
	if pathFilter != nil {
		wrappedPathFilter = wrapPathFilter(pathFilter, rootFolder)
	} else {
		wrappedPathFilter = wrapPathFilter(NewAllowAllPathFilter(), rootFolder)
	}

	return &wrapper{
		log:        log,
		wrapped:    wrapped,
		filter:     wrappedPathFilter,
		rootFolder: rootFolder,
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

func (b wrapper) validatePath(path string) error {
	if err := ValidatePath(path); err != nil {
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

func (b wrapper) getOptionsWithDefaults(options *GetFileOptions) *GetFileOptions {
	if options == nil {
		return &GetFileOptions{WithContents: true}
	}

	return options
}

func (b wrapper) Get(ctx context.Context, path string, options *GetFileOptions) (*File, bool, error) {
	if err := b.validatePath(path); err != nil {
		return nil, false, err
	}

	rootedPath := b.addRoot(path)
	if !b.filter.IsAllowed(rootedPath) {
		return nil, false, nil
	}

	optionsWithDefaults := b.getOptionsWithDefaults(options)

	if b.rootFolder == rootedPath {
		return nil, false, nil
	}

	file, _, err := b.wrapped.Get(ctx, rootedPath, optionsWithDefaults)
	if file != nil {
		file.FullPath = b.removeRoot(file.FullPath)
	}
	return file, file != nil, err
}

func (b wrapper) Delete(ctx context.Context, path string) error {
	if err := b.validatePath(path); err != nil {
		return err
	}

	rootedPath := b.addRoot(path)
	if !b.filter.IsAllowed(rootedPath) {
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
	if !b.filter.IsAllowed(rootedPath) {
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

func (b wrapper) listOptionsWithDefaults(options *ListOptions) *ListOptions {
	if options == nil {
		return &ListOptions{
			Recursive:    false,
			Filter:       b.filter,
			WithFiles:    true,
			WithFolders:  false,
			WithContents: false,
		}
	}

	withFiles := options.WithFiles
	if !options.WithFiles && !options.WithFolders {
		withFiles = true
	}
	if b.filter == nil {
		return &ListOptions{
			Recursive:    options.Recursive,
			Filter:       b.filter,
			WithFiles:    withFiles,
			WithFolders:  options.WithFolders,
			WithContents: options.WithContents,
		}
	}

	var filter PathFilter
	if options.Filter != nil {
		filter = newAndPathFilter(b.filter, wrapPathFilter(options.Filter, b.rootFolder))
	} else {
		filter = b.filter
	}
	return &ListOptions{
		Recursive:    options.Recursive,
		Filter:       filter,
		WithFiles:    withFiles,
		WithFolders:  options.WithFolders,
		WithContents: options.WithContents,
	}
}

func (b wrapper) CreateFolder(ctx context.Context, path string) error {
	if err := b.validatePath(path); err != nil {
		return err
	}

	rootedPath := b.addRoot(path)
	if !b.filter.IsAllowed(rootedPath) {
		return nil
	}

	return b.wrapped.CreateFolder(ctx, rootedPath)
}

func (b wrapper) deleteFolderOptionsWithDefaults(options *DeleteFolderOptions) *DeleteFolderOptions {
	if options == nil {
		return &DeleteFolderOptions{
			Force:        false,
			AccessFilter: b.filter,
		}
	}

	if options.AccessFilter == nil {
		return &DeleteFolderOptions{
			Force:        options.Force,
			AccessFilter: b.filter,
		}
	}

	var filter PathFilter
	if options.AccessFilter != nil {
		filter = newAndPathFilter(b.filter, wrapPathFilter(options.AccessFilter, b.rootFolder))
	} else {
		filter = b.filter
	}

	return &DeleteFolderOptions{
		Force:        options.Force,
		AccessFilter: filter,
	}
}

func (b wrapper) DeleteFolder(ctx context.Context, path string, options *DeleteFolderOptions) error {
	if err := b.validatePath(path); err != nil {
		return err
	}

	rootedPath := b.addRoot(path)

	optionsWithDefaults := b.deleteFolderOptionsWithDefaults(options)
	if !optionsWithDefaults.AccessFilter.IsAllowed(rootedPath) {
		return fmt.Errorf("delete folder unauthorized - no access to %s", rootedPath)
	}

	if !optionsWithDefaults.Force {
		isEmpty, err := b.isFolderEmpty(ctx, path)
		if err != nil {
			return err
		}

		if !isEmpty {
			return fmt.Errorf("folder %s is not empty - cant remove it", path)
		}
	}

	return b.wrapped.DeleteFolder(ctx, rootedPath, optionsWithDefaults)
}

func (b wrapper) List(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListResponse, error) {
	if err := b.validatePath(folderPath); err != nil {
		return nil, err
	}

	options = b.listOptionsWithDefaults(options)

	var fileChan = make(chan *File)
	fileRetrievalCtx, cancelFileGet := context.WithCancel(ctx)
	defer cancelFileGet()

	go func() {
		if options.WithFiles {
			var getOptions *GetFileOptions
			if options.WithContents {
				getOptions = &GetFileOptions{WithContents: true}
			}
			if f, _, err := b.Get(fileRetrievalCtx, folderPath, getOptions); err == nil {
				fileChan <- f
				return
			}
		}
		fileChan <- nil
	}()

	pathWithRoot := b.addRoot(folderPath)
	resp, err := b.wrapped.List(ctx, pathWithRoot, b.pagingOptionsWithDefaults(paging), options)
	if err != nil {
		return nil, err
	}

	if resp != nil && resp.Files != nil && len(resp.Files) > 0 {
		if resp.LastPath != "" {
			resp.LastPath = b.removeRoot(resp.LastPath)
		}

		for i := 0; i < len(resp.Files); i++ {
			resp.Files[i].FullPath = b.removeRoot(resp.Files[i].FullPath)
		}
		return resp, err
	}

	file := <-fileChan
	if file != nil {
		var contents []byte
		if options.WithContents {
			contents = file.Contents
		} else {
			contents = []byte{}
		}
		return &ListResponse{
			Files:    []*File{{Contents: contents, FileMetadata: file.FileMetadata}},
			HasMore:  false,
			LastPath: file.FileMetadata.FullPath,
		}, nil
	}

	return resp, err
}

func (b wrapper) isFolderEmpty(ctx context.Context, path string) (bool, error) {
	resp, err := b.List(ctx, path, &Paging{First: 1}, &ListOptions{Recursive: true, WithFolders: true, WithFiles: true})
	if err != nil {
		return false, err
	}

	if len(resp.Files) > 0 {
		return false, nil
	}

	return true, nil
}

func (b wrapper) close() error {
	return b.wrapped.close()
}
