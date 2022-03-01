package filestorage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"
)

const (
	originalPathAttributeKey = "__gf_original_path__"
)

type cdkBlobStorage struct {
	log        log.Logger
	bucket     *blob.Bucket
	rootFolder string
}

func NewCdkBlobStorage(log log.Logger, bucket *blob.Bucket, rootFolder string, pathFilters *PathFilters) FileStorage {
	return &wrapper{
		log: log,
		wrapped: &cdkBlobStorage{
			log:        log,
			bucket:     bucket,
			rootFolder: rootFolder,
		},
		pathFilters: pathFilters,
	}
}

func (c cdkBlobStorage) Get(ctx context.Context, filePath string) (*File, error) {
	contents, err := c.bucket.ReadAll(ctx, strings.ToLower(filePath))
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return nil, nil
		}
		return nil, err
	}
	attributes, err := c.bucket.Attributes(ctx, strings.ToLower(filePath))
	if err != nil {
		return nil, err
	}

	var originalPath string
	var props map[string]string
	if attributes.Metadata != nil {
		props = attributes.Metadata
		if path, ok := attributes.Metadata[originalPathAttributeKey]; ok {
			originalPath = path
			delete(props, originalPathAttributeKey)
		}
	} else {
		props = make(map[string]string)
		originalPath = filePath
	}

	return &File{
		Contents: contents,
		FileMetadata: FileMetadata{
			Name:       getName(originalPath),
			FullPath:   originalPath,
			Created:    attributes.CreateTime,
			Properties: props,
			Modified:   attributes.ModTime,
			Size:       attributes.Size,
			MimeType:   detectContentType(originalPath, attributes.ContentType),
		},
	}, nil
}

func (c cdkBlobStorage) Delete(ctx context.Context, filePath string) error {
	exists, err := c.bucket.Exists(ctx, strings.ToLower(filePath))
	if err != nil {
		return err
	}

	if !exists {
		return nil
	}

	err = c.bucket.Delete(ctx, strings.ToLower(filePath))
	return err
}

func (c cdkBlobStorage) Upsert(ctx context.Context, command *UpsertFileCommand) error {
	existing, err := c.Get(ctx, command.Path)
	if err != nil {
		return err
	}

	var contents []byte
	var metadata map[string]string

	if existing == nil {
		if command.Contents == nil {
			contents = make([]byte, 0)
		} else {
			contents = *command.Contents
		}

		metadata = make(map[string]string)
		if command.Properties != nil {
			for k, v := range command.Properties {
				metadata[k] = v
			}
		}
		metadata[originalPathAttributeKey] = command.Path
		return c.bucket.WriteAll(ctx, strings.ToLower(command.Path), contents, &blob.WriterOptions{
			Metadata: metadata,
		})
	}

	contents = existing.Contents
	if command.Contents != nil {
		contents = *command.Contents
	}

	if command.Properties != nil {
		metadata = make(map[string]string)
		for k, v := range command.Properties {
			metadata[k] = v
		}
	} else {
		metadata = existing.FileMetadata.Properties
	}

	metadata[originalPathAttributeKey] = existing.FullPath
	return c.bucket.WriteAll(ctx, strings.ToLower(command.Path), contents, &blob.WriterOptions{
		Metadata: metadata,
	})
}

func (c cdkBlobStorage) listFiles(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListFilesResponse, error) {
	iterator := c.bucket.List(&blob.ListOptions{
		Prefix:    strings.ToLower(folderPath),
		Delimiter: Delimiter,
	})

	recursive := options.Recursive

	pageSize := paging.First

	foundCursor := true
	if paging.After != "" {
		foundCursor = false
	}

	hasMore := true
	files := make([]FileMetadata, 0)
	for {
		obj, err := iterator.Next(ctx)
		if obj != nil && strings.HasSuffix(obj.Key, directoryMarker) {
			continue
		}

		if errors.Is(err, io.EOF) {
			hasMore = false
			break
		} else {
			hasMore = true
		}

		if err != nil {
			c.log.Error("Failed while iterating over files", "err", err)
			return nil, err
		}

		if len(files) >= pageSize {
			break
		}

		path := obj.Key

		allowed := options.isAllowed(obj.Key)
		if obj.IsDir && recursive {
			newPaging := &Paging{
				First: pageSize - len(files),
			}
			if paging != nil {
				newPaging.After = paging.After
			}

			resp, err := c.listFiles(ctx, path, newPaging, options)

			if err != nil {
				return nil, err
			}

			if len(files) > 0 {
				foundCursor = true
			}

			files = append(files, resp.Files...)
			if len(files) >= pageSize {
				//nolint: staticcheck
				hasMore = resp.HasMore
			}
		} else if !obj.IsDir && allowed {
			if !foundCursor {
				res := strings.Compare(obj.Key, paging.After)
				if res < 0 {
					continue
				} else if res == 0 {
					foundCursor = true
					continue
				} else {
					foundCursor = true
				}
			}

			attributes, err := c.bucket.Attributes(ctx, strings.ToLower(path))
			if err != nil {
				c.log.Error("Failed while retrieving attributes", "path", path, "err", err)
				return nil, err
			}

			var originalPath string
			var props map[string]string
			if attributes.Metadata != nil {
				props = attributes.Metadata
				if path, ok := attributes.Metadata[originalPathAttributeKey]; ok {
					originalPath = path
					delete(props, originalPathAttributeKey)
				}
			} else {
				props = make(map[string]string)
				originalPath = fixPath(path)
			}

			files = append(files, FileMetadata{
				Name:       getName(originalPath),
				FullPath:   originalPath,
				Created:    attributes.CreateTime,
				Properties: props,
				Modified:   attributes.ModTime,
				Size:       attributes.Size,
				MimeType:   detectContentType(originalPath, attributes.ContentType),
			})
		}
	}

	lastPath := ""
	if len(files) > 0 {
		lastPath = files[len(files)-1].FullPath
	}

	return &ListFilesResponse{
		Files:    files,
		HasMore:  hasMore,
		LastPath: lastPath,
	}, nil
}

func (c cdkBlobStorage) fixInputPrefix(path string) string {
	if path == Delimiter || path == "" {
		return c.rootFolder
	}
	if strings.HasPrefix(path, Delimiter) {
		path = fmt.Sprintf("%s%s", c.rootFolder, strings.TrimPrefix(path, Delimiter))
	}

	return path
}

func (c cdkBlobStorage) convertFolderPathToPrefix(path string) string {
	if path == Delimiter || path == "" {
		return c.rootFolder
	}
	if strings.HasPrefix(path, Delimiter) {
		path = fmt.Sprintf("%s%s", c.rootFolder, strings.TrimPrefix(path, Delimiter))
	}
	return fmt.Sprintf("%s%s", path, Delimiter)
}

func fixPath(path string) string {
	newPath := strings.TrimSuffix(path, Delimiter)
	if !strings.HasPrefix(newPath, Delimiter) {
		newPath = fmt.Sprintf("%s%s", Delimiter, newPath)
	}
	return newPath
}

func (c cdkBlobStorage) convertListOptions(options *ListOptions) *ListOptions {
	if options == nil || options.allowedPrefixes == nil || len(options.allowedPrefixes) == 0 {
		return options
	}

	newPrefixes := make([]string, len(options.allowedPrefixes))
	for i, prefix := range options.allowedPrefixes {
		newPrefixes[i] = c.fixInputPrefix(prefix)
	}

	options.PathFilters.allowedPrefixes = newPrefixes
	return options
}

func (c cdkBlobStorage) ListFiles(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListFilesResponse, error) {
	paging.After = c.fixInputPrefix(paging.After)
	return c.listFiles(ctx, c.convertFolderPathToPrefix(folderPath), paging, c.convertListOptions(options))
}

func (c cdkBlobStorage) listFolderPaths(ctx context.Context, parentFolderPath string, options *ListOptions) ([]string, error) {
	iterator := c.bucket.List(&blob.ListOptions{
		Prefix:    strings.ToLower(parentFolderPath),
		Delimiter: Delimiter,
	})

	recursive := options.Recursive

	currentDirPath := ""
	foundPaths := make([]string, 0)
	for {
		obj, err := iterator.Next(ctx)
		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			c.log.Error("Failed while iterating over files", "err", err)
			return nil, err
		}

		if currentDirPath == "" && !obj.IsDir && options.isAllowed(obj.Key) {
			attributes, err := c.bucket.Attributes(ctx, obj.Key)
			if err != nil {
				c.log.Error("Failed while retrieving attributes", "path", obj.Key, "err", err)
				return nil, err
			}

			if attributes.Metadata != nil {
				if path, ok := attributes.Metadata[originalPathAttributeKey]; ok {
					currentDirPath = getParentFolderPath(path)
				}
			}
		}

		if obj.IsDir && recursive {
			resp, err := c.listFolderPaths(ctx, obj.Key, options)

			if err != nil {
				return nil, err
			}

			if len(resp) > 0 {
				foundPaths = append(foundPaths, resp...)
			}
			continue
		}
	}

	if currentDirPath != "" {
		foundPaths = append(foundPaths, fixPath(currentDirPath))
	}
	return foundPaths, nil
}

func (c cdkBlobStorage) ListFolders(ctx context.Context, prefix string, options *ListOptions) ([]FileMetadata, error) {
	foundPaths, err := c.listFolderPaths(ctx, c.convertFolderPathToPrefix(prefix), c.convertListOptions(options))
	if err != nil {
		return nil, err
	}

	folders := make([]FileMetadata, 0)
	mem := make(map[string]bool)
	for i := 0; i < len(foundPaths); i++ {
		path := foundPaths[i]
		parts := strings.Split(path, Delimiter)
		acc := parts[0]
		j := 1
		for {
			acc = fmt.Sprintf("%s%s%s", acc, Delimiter, parts[j])

			comparison := strings.Compare(acc, prefix)
			if !mem[acc] && comparison > 0 {
				folders = append(folders, FileMetadata{
					Name:     getName(acc),
					FullPath: acc,
				})
			}
			mem[acc] = true

			j += 1
			if j >= len(parts) {
				break
			}
		}
	}

	return folders, err
}

func precedingFolders(path string) []string {
	parts := strings.Split(path, Delimiter)
	if len(parts) == 0 {
		return []string{}
	}

	if len(parts) == 1 {
		return []string{path}
	}

	currentDirPath := ""
	firstPart := 0
	if parts[0] == "" {
		firstPart = 1
		currentDirPath = Delimiter
	}

	res := make([]string, 0)
	for i := firstPart; i < len(parts); i++ {
		res = append(res, currentDirPath+parts[i])
		currentDirPath += parts[i] + Delimiter
	}

	return res
}

func (c cdkBlobStorage) CreateFolder(ctx context.Context, path string) error {
	c.log.Info("Creating folder", "path", path)

	precedingFolders := precedingFolders(path)
	folderToOriginalCasing := make(map[string]string)
	foundFolderIndex := -1

	for i := len(precedingFolders) - 1; i >= 0; i-- {
		currentFolder := precedingFolders[i]
		att, err := c.bucket.Attributes(ctx, strings.ToLower(currentFolder+Delimiter+directoryMarker))
		if err != nil {
			if gcerrors.Code(err) != gcerrors.NotFound {
				return err
			}
			folderToOriginalCasing[currentFolder] = currentFolder
			continue
		}

		if path, ok := att.Metadata[originalPathAttributeKey]; ok {
			folderToOriginalCasing[currentFolder] = getParentFolderPath(path)
			foundFolderIndex = i
			break
		} else {
			folderToOriginalCasing[currentFolder] = currentFolder
		}
	}

	for i := foundFolderIndex + 1; i < len(precedingFolders); i++ {
		currentFolder := precedingFolders[i]

		previousFolderOriginalCasing := ""
		if i > 0 {
			previousFolderOriginalCasing = folderToOriginalCasing[precedingFolders[i-1]]
		}

		metadata := make(map[string]string)
		currentFolderWithOriginalCasing := previousFolderOriginalCasing + Delimiter + getName(currentFolder)
		metadata[originalPathAttributeKey] = currentFolderWithOriginalCasing + Delimiter + directoryMarker
		if err := c.bucket.WriteAll(ctx, strings.ToLower(metadata[originalPathAttributeKey]), make([]byte, 0), &blob.WriterOptions{
			Metadata: metadata,
		}); err != nil {
			return err
		}
		c.log.Info("Created folder", "path", currentFolderWithOriginalCasing, "marker", metadata[originalPathAttributeKey])
	}

	return nil
}

func (c cdkBlobStorage) DeleteFolder(ctx context.Context, folderPath string) error {
	directoryMarkerPath := fmt.Sprintf("%s%s%s", folderPath, Delimiter, directoryMarker)
	exists, err := c.bucket.Exists(ctx, strings.ToLower(directoryMarkerPath))

	if err != nil {
		return err
	}

	if !exists {
		return nil
	}

	err = c.bucket.Delete(ctx, strings.ToLower(directoryMarkerPath))
	return err
}

func (c cdkBlobStorage) close() error {
	return c.bucket.Close()
}
