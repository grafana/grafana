package filestorage

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"
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

func (c cdkBlobStorage) closeReader(reader *blob.Reader) {
	if err := reader.Close(); err != nil {
		c.log.Error("Failed to close reader", "err", err)
	}
}

func (c cdkBlobStorage) Get(ctx context.Context, filePath string) (*File, error) {
	contents, err := c.bucket.ReadAll(ctx, filePath)
	if err != nil {
		if gcerrors.Code(err) == gcerrors.NotFound {
			return nil, nil
		}
		return nil, err
	}
	attributes, err := c.bucket.Attributes(ctx, filePath)
	if err != nil {
		return nil, err
	}

	var props map[string]string
	if attributes.Metadata != nil {
		props = attributes.Metadata
	} else {
		props = make(map[string]string, 0)
	}

	return &File{
		Contents: contents,
		FileMetadata: FileMetadata{
			Name:       getName(filePath),
			FullPath:   filePath,
			Created:    attributes.CreateTime,
			Properties: props,
			Modified:   attributes.ModTime,
			Size:       attributes.Size,
			MimeType:   detectContentType(filePath, attributes.ContentType),
		},
	}, nil
}

func (c cdkBlobStorage) Delete(ctx context.Context, filePath string) error {
	exists, err := c.bucket.Exists(ctx, filePath)
	if err != nil {
		return err
	}

	if !exists {
		return nil
	}

	err = c.bucket.Delete(ctx, filePath)
	return err
}

func (c cdkBlobStorage) Upsert(ctx context.Context, command *UpsertFileCommand) error {
	existing, err := c.Get(ctx, command.Path)
	if err != nil {
		return err
	}

	var contents []byte

	if existing == nil {
		if command.Contents == nil {
			contents = make([]byte, 0)
		} else {
			contents = *command.Contents
		}
		return c.bucket.WriteAll(ctx, command.Path, contents, &blob.WriterOptions{
			Metadata: command.Properties,
		})
	}

	contents = existing.Contents
	if command.Contents != nil {
		contents = *command.Contents
	}

	metadata := existing.FileMetadata.Properties
	for k, v := range command.Properties {
		metadata[k] = v
	}

	return c.bucket.WriteAll(ctx, command.Path, contents, &blob.WriterOptions{
		Metadata: command.Properties,
	})
}

func (c cdkBlobStorage) listFiles(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListFilesResponse, error) {
	iterator := c.bucket.List(&blob.ListOptions{
		Prefix:    folderPath,
		Delimiter: Delimiter,
	})

	recursive := options.Recursive

	pageSize := paging.First

	foundCursor := true
	if paging.After != "" {
		foundCursor = false
	}

	hasMore := true
	var files []FileMetadata
	for {
		obj, err := iterator.Next(ctx)
		if err == io.EOF {
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

		if strings.HasSuffix(path, directoryMarker) {
			continue
		}

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

			attributes, err := c.bucket.Attributes(ctx, path)
			if err != nil {
				c.log.Error("Failed while retrieving attributes", "path", path, "err", err)
				return nil, err
			}

			fullPath := fixPath(path)

			var props map[string]string
			if attributes.Metadata != nil {
				props = attributes.Metadata
			} else {
				props = make(map[string]string, 0)
			}

			files = append(files, FileMetadata{
				Name:       getName(fullPath),
				FullPath:   fullPath,
				Created:    attributes.CreateTime,
				Properties: props,
				Modified:   attributes.ModTime,
				Size:       attributes.Size,
				MimeType:   detectContentType(fullPath, attributes.ContentType),
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

func (c cdkBlobStorage) listFolders(ctx context.Context, parentFolderPath string, options *ListOptions) ([]FileMetadata, error) {
	iterator := c.bucket.List(&blob.ListOptions{
		Prefix:    parentFolderPath,
		Delimiter: Delimiter,
	})

	recursive := options.Recursive

	var folders []FileMetadata
	for {
		obj, err := iterator.Next(ctx)
		if err == io.EOF {
			break
		}

		if err != nil {
			c.log.Error("Failed while iterating over files", "err", err)
			return nil, err
		}

		if !obj.IsDir {
			continue
		}

		path := obj.Key

		if options.isAllowed(path) {
			folderPath := fixPath(path)
			folders = append(folders, FileMetadata{
				Name:     getName(folderPath),
				FullPath: folderPath,
				Modified: obj.ModTime,
				Created:  obj.ModTime,
				Size:     0,
				MimeType: "",
			})
		}

		if recursive {
			resp, err := c.listFolders(ctx, obj.Key, options)

			if err != nil {
				return nil, err
			}

			if resp != nil && len(resp) > 0 {
				folders = append(folders, resp...)
			}
		}
	}
	return folders, nil
}

func (c cdkBlobStorage) ListFolders(ctx context.Context, parentFolderPath string, options *ListOptions) ([]FileMetadata, error) {
	folders, err := c.listFolders(ctx, c.convertFolderPathToPrefix(parentFolderPath), c.convertListOptions(options))
	return folders, err
}

func (c cdkBlobStorage) CreateFolder(ctx context.Context, parentFolderPath string, folderName string) error {
	directoryMarkerParentPath := fmt.Sprintf("%s%s%s", parentFolderPath, Delimiter, folderName)
	directoryMarkerPath := fmt.Sprintf("%s%s%s", directoryMarkerParentPath, Delimiter, directoryMarker)

	exists, err := c.bucket.Exists(ctx, directoryMarkerPath)

	if err != nil {
		return err
	}

	if exists {
		return nil
	}

	err = c.bucket.WriteAll(ctx, directoryMarkerPath, make([]byte, 0), nil)
	return err
}

func (c cdkBlobStorage) DeleteFolder(ctx context.Context, folderPath string) error {
	directoryMarkerPath := fmt.Sprintf("%s%s%s", folderPath, Delimiter, directoryMarker)
	exists, err := c.bucket.Exists(ctx, directoryMarkerPath)

	if err != nil {
		return err
	}

	if !exists {
		return nil
	}

	err = c.bucket.Delete(ctx, directoryMarkerPath)
	return err

}

func (c cdkBlobStorage) close() error {
	return c.bucket.Close()
}
