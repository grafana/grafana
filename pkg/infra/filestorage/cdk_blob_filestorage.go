package filestorage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"

	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/memblob"
)

const (
	originalPathAttributeKey = "__gf_original_path__"
)

type cdkBlobStorage struct {
	log    log.Logger
	bucket *blob.Bucket
}

func NewCdkBlobStorage(log log.Logger, bucket *blob.Bucket, rootFolder string, pathFilters *PathFilters) FileStorage {
	return newWrapper(log, &cdkBlobStorage{
		log:    log,
		bucket: bucket,
	}, pathFilters, rootFolder)
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

		allowed := options.IsAllowed(obj.Key)
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

func (c cdkBlobStorage) convertFolderPathToPrefix(path string) string {
	if path != "" && !strings.HasSuffix(path, Delimiter) {
		return path + Delimiter
	}
	return path
}

func (c cdkBlobStorage) ListFiles(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListFilesResponse, error) {
	prefix := c.convertFolderPathToPrefix(folderPath)
	files, err := c.listFiles(ctx, prefix, paging, options)
	return files, err
}

func (c cdkBlobStorage) listFolderPaths(ctx context.Context, parentFolderPath string, options *ListOptions) ([]string, error) {
	iterator := c.bucket.List(&blob.ListOptions{
		Prefix:    strings.ToLower(parentFolderPath),
		Delimiter: Delimiter,
	})

	recursive := options.Recursive

	dirPath := ""
	dirMarkerPath := ""
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

		if options.IsAllowed(obj.Key) {
			if obj.IsDir && !recursive && options.IsAllowed(obj.Key) {
				var nestedDirPath string
				dirMPath := obj.Key + directoryMarker
				attributes, err := c.bucket.Attributes(ctx, dirMPath)
				if err != nil {
					c.log.Error("Failed while retrieving attributes", "path", obj.Key, "err", err)
				}

				if attributes != nil && attributes.Metadata != nil {
					if path, ok := attributes.Metadata[originalPathAttributeKey]; ok {
						nestedDirPath = getParentFolderPath(path)
					}
				}

				if nestedDirPath != "" {
					foundPaths = append(foundPaths, nestedDirPath)
				} else {
					foundPaths = append(foundPaths, strings.TrimSuffix(obj.Key, Delimiter))
				}
			}

			if dirPath == "" && !obj.IsDir {
				dirPath = getParentFolderPath(obj.Key)
			}

			if dirMarkerPath == "" && !obj.IsDir {
				attributes, err := c.bucket.Attributes(ctx, obj.Key)
				if err != nil {
					c.log.Error("Failed while retrieving attributes", "path", obj.Key, "err", err)
					return nil, err
				}

				if attributes.Metadata != nil {
					if path, ok := attributes.Metadata[originalPathAttributeKey]; ok {
						dirMarkerPath = getParentFolderPath(path)
					}
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

	var foundPath string
	if dirMarkerPath != "" {
		foundPath = dirMarkerPath
	} else if dirPath != "" {
		foundPath = dirPath
	}

	if foundPath != "" && options.IsAllowed(foundPath+Delimiter) {
		foundPaths = append(foundPaths, foundPath)
	}
	return foundPaths, nil
}

func (c cdkBlobStorage) ListFolders(ctx context.Context, prefix string, options *ListOptions) ([]FileMetadata, error) {
	fixedPrefix := c.convertFolderPathToPrefix(prefix)
	foundPaths, err := c.listFolderPaths(ctx, fixedPrefix, options)
	if err != nil {
		return nil, err
	}

	sort.Strings(foundPaths)
	folders := make([]FileMetadata, 0)

	for _, path := range foundPaths {
		if strings.Compare(path, fixedPrefix) > 0 {
			folders = append(folders, FileMetadata{
				Name:     getName(path),
				FullPath: path,
			})
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
