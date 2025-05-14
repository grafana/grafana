package filestorage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"gocloud.dev/blob"
	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/memblob"
	"gocloud.dev/gcerrors"

	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	originalPathAttributeKey = "__gf_original_path__"
)

type cdkBlobStorage struct {
	log    log.Logger
	bucket *blob.Bucket
}

func NewCdkBlobStorage(log log.Logger, bucket *blob.Bucket, rootFolder string, filter PathFilter) FileStorage {
	return newWrapper(log, &cdkBlobStorage{
		log:    log,
		bucket: bucket,
	}, filter, rootFolder)
}

func (c cdkBlobStorage) Get(ctx context.Context, path string, options *GetFileOptions) (*File, bool, error) {
	var err error
	var contents []byte
	if options.WithContents {
		contents, err = c.bucket.ReadAll(ctx, strings.ToLower(path))
		if err != nil {
			if gcerrors.Code(err) == gcerrors.NotFound {
				return nil, false, nil
			}
			return nil, false, err
		}
	} else {
		contents = make([]byte, 0)
	}

	attributes, err := c.bucket.Attributes(ctx, strings.ToLower(path))
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return nil, false, nil
		}
		return nil, false, err
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
		originalPath = path
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
	}, true, nil
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
	existing, _, err := c.Get(ctx, command.Path, &GetFileOptions{WithContents: true})
	if err != nil {
		return err
	}

	var contents []byte
	var metadata map[string]string

	if existing == nil {
		if command.Contents == nil {
			contents = make([]byte, 0)
		} else {
			contents = command.Contents
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
		contents = command.Contents
	}

	if command.Properties != nil {
		metadata = make(map[string]string)
		for k, v := range command.Properties {
			metadata[k] = v
		}
	} else {
		metadata = existing.Properties
	}

	metadata[originalPathAttributeKey] = existing.FullPath
	return c.bucket.WriteAll(ctx, strings.ToLower(command.Path), contents, &blob.WriterOptions{
		Metadata: metadata,
	})
}

func (c cdkBlobStorage) convertFolderPathToPrefix(path string) string {
	if path != "" && !strings.HasSuffix(path, Delimiter) {
		return path + Delimiter
	}
	return path
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
			previousFolderOriginalCasing = folderToOriginalCasing[precedingFolders[i-1]] + Delimiter
		}

		metadata := make(map[string]string)
		currentFolderWithOriginalCasing := previousFolderOriginalCasing + getName(currentFolder)
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

func (c cdkBlobStorage) DeleteFolder(ctx context.Context, folderPath string, options *DeleteFolderOptions) error {
	folderPrefix := strings.ToLower(c.convertFolderPathToPrefix(folderPath))
	directoryMarkerPath := folderPrefix + directoryMarker
	if !options.Force {
		return c.bucket.Delete(ctx, directoryMarkerPath)
	}

	iterators := []*blob.ListIterator{c.bucket.List(&blob.ListOptions{
		Prefix:    folderPrefix,
		Delimiter: Delimiter,
	})}

	var pathsToDelete []string

	for len(iterators) > 0 {
		obj, err := iterators[0].Next(ctx)
		if errors.Is(err, io.EOF) {
			iterators = iterators[1:]
			continue
		}

		if err != nil {
			c.log.Error("Force folder delete: failed to retrieve next object", "err", err)
			return err
		}

		path := obj.Key
		lowerPath := strings.ToLower(path)
		if obj.IsDir {
			iterators = append([]*blob.ListIterator{c.bucket.List(&blob.ListOptions{
				Prefix:    lowerPath,
				Delimiter: Delimiter,
			})}, iterators...)
			continue
		}

		pathsToDelete = append(pathsToDelete, lowerPath)
	}

	for _, path := range pathsToDelete {
		if !options.AccessFilter.IsAllowed(path) {
			c.log.Error("Force folder delete: unauthorized access", "path", path)
			return fmt.Errorf("force folder delete error, unauthorized access to %s", path)
		}
	}

	var lastErr error
	for _, path := range pathsToDelete {
		if err := c.bucket.Delete(ctx, path); err != nil {
			c.log.Error("Force folder delete: failed while deleting a file", "err", err, "path", path)
			lastErr = err
			// keep going and delete remaining files
		}
	}

	return lastErr
}

//nolint:gocyclo
func (c cdkBlobStorage) list(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListResponse, error) {
	lowerRootPath := strings.ToLower(folderPath)
	iterators := []*blob.ListIterator{c.bucket.List(&blob.ListOptions{
		Prefix:    lowerRootPath,
		Delimiter: Delimiter,
	})}

	recursive := options.Recursive
	pageSize := paging.Limit

	foundCursor := paging.After == ""

	files := make([]*File, 0)

	visitedFolders := map[string]bool{}
	visitedFolders[lowerRootPath] = true

	for len(iterators) > 0 && len(files) <= pageSize {
		obj, err := iterators[0].Next(ctx)
		if errors.Is(err, io.EOF) {
			iterators = iterators[1:]
			continue
		}

		if err != nil {
			c.log.Error("Failed while iterating over files", "err", err)
			return nil, err
		}

		path := obj.Key
		lowerPath := strings.ToLower(path)
		allowed := options.Filter.IsAllowed(lowerPath)

		if obj.IsDir && recursive && !visitedFolders[lowerPath] {
			iterators = append([]*blob.ListIterator{c.bucket.List(&blob.ListOptions{
				Prefix:    lowerPath,
				Delimiter: Delimiter,
			})}, iterators...)
			visitedFolders[lowerPath] = true
		}

		if !foundCursor {
			res := strings.Compare(strings.TrimSuffix(lowerPath, Delimiter), paging.After)
			if res < 0 {
				continue
			} else if res == 0 {
				foundCursor = true
				continue
			} else {
				foundCursor = true
			}
		}

		if obj.IsDir {
			if options.WithFolders && allowed {
				originalCasingPath := ""
				dirMarkerPath := obj.Key + directoryMarker
				attributes, err := c.bucket.Attributes(ctx, dirMarkerPath)
				if err == nil && attributes != nil && attributes.Metadata != nil {
					if path, ok := attributes.Metadata[originalPathAttributeKey]; ok {
						originalCasingPath = getParentFolderPath(path)
					}
				}

				var p string
				if originalCasingPath != "" {
					p = originalCasingPath
				} else {
					p = strings.TrimSuffix(obj.Key, Delimiter)
				}

				files = append(files, &File{
					Contents: nil,
					FileMetadata: FileMetadata{
						MimeType:   DirectoryMimeType,
						Name:       getName(p),
						Properties: map[string]string{},
						FullPath:   p,
					},
				})
			}
			continue
		}

		if strings.HasSuffix(obj.Key, directoryMarker) {
			continue
		}

		if options.WithFiles && allowed {
			attributes, err := c.bucket.Attributes(ctx, strings.ToLower(path))
			if err != nil {
				if gcerrors.Code(err) == gcerrors.NotFound {
					attributes, err = c.bucket.Attributes(ctx, path)
					if err != nil {
						c.log.Error("Failed while retrieving attributes", "path", path, "err", err)
						return nil, err
					}
				} else {
					c.log.Error("Failed while retrieving attributes", "path", path, "err", err)
					return nil, err
				}
			}

			if attributes.ContentType == "application/x-directory; charset=UTF-8" {
				// S3 directory representation
				continue
			}

			if attributes.ContentType == "text/plain" && obj.Key == folderPath && attributes.Size == 0 {
				// GCS directory representation
				continue
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
				originalPath = strings.TrimSuffix(path, Delimiter)
			}

			var contents []byte
			if options.WithContents {
				c, err := c.bucket.ReadAll(ctx, lowerPath)
				if err != nil && gcerrors.Code(err) != gcerrors.NotFound {
					return nil, err
				}

				if c != nil {
					contents = c
				}
			}

			files = append(files, &File{
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
			})
		}
	}

	hasMore := false
	if len(files) > pageSize {
		hasMore = true
		files = files[:pageSize]
	}

	lastPath := ""
	if len(files) > 0 {
		lastPath = files[len(files)-1].FullPath
	}

	return &ListResponse{
		Files:    files,
		HasMore:  hasMore,
		LastPath: lastPath,
	}, nil
}

func (c cdkBlobStorage) List(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListResponse, error) {
	prefix := c.convertFolderPathToPrefix(folderPath)
	return c.list(ctx, prefix, paging, options)
}

func (c cdkBlobStorage) close() error {
	return c.bucket.Close()
}
