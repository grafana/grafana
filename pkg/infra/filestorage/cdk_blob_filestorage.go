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

	return &File{
		Contents: contents,
		FileMetadata: FileMetadata{
			Name:       getName(filePath),
			FullPath:   filePath,
			Created:    attributes.CreateTime,
			Properties: attributes.Metadata,
		},
	}, nil
}

func (c cdkBlobStorage) Delete(ctx context.Context, filePath string) error {
	//TODO implement me
	panic("implement me")
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

func (c cdkBlobStorage) listFiles(ctx context.Context, folderPath string, recursive bool, paging *Paging) (*ListFilesResponse, error) {
	iterator := c.bucket.List(&blob.ListOptions{
		Prefix:    folderPath,
		Delimiter: Delimiter,
	})

	pageSize := 10
	if paging != nil && paging.First != 0 {
		pageSize = paging.First
	}

	foundCursor := true
	if paging != nil && paging.After != "" {
		foundCursor = false
	}

	hasMore := true
	var files []FileMetadata
	for {
		obj, err := iterator.Next(ctx)
		if err == io.EOF {
			hasMore = false
			break
		}

		if err != nil {
			c.log.Error("Failed while iterating over files", "err", err)
			return nil, err
		}

		if len(files) >= pageSize {
			break
		}

		path := obj.Key
		if obj.IsDir && recursive {
			newPaging := &Paging{
				First: pageSize - len(files),
			}
			if paging != nil {
				newPaging.After = paging.After
			}

			resp, err := c.listFiles(ctx, path, true, newPaging)

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
		} else if !obj.IsDir {
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
			files = append(files, FileMetadata{
				Name:       getName(fullPath),
				FullPath:   fullPath,
				Created:    attributes.CreateTime,
				Properties: attributes.Metadata,
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

func (c cdkBlobStorage) getPrefix(path string) string {
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

func (c cdkBlobStorage) ListFiles(ctx context.Context, folderPath string, recursive bool, paging *Paging) (*ListFilesResponse, error) {
	return c.listFiles(ctx, c.getPrefix(folderPath), recursive, paging)
}

func (c cdkBlobStorage) listFolders(ctx context.Context, parentFolderPath string) ([]Folder, error) {
	iterator := c.bucket.List(&blob.ListOptions{
		Prefix:    parentFolderPath,
		Delimiter: Delimiter,
	})

	var folders []Folder
	for {
		obj, err := iterator.Next(ctx)
		if err == io.EOF {
			break
		}

		if err != nil {
			c.log.Error("Failed while iterating over files", "err", err)
			return nil, err
		}

		if obj.IsDir {
			path := obj.Key

			folderPath := fixPath(path)
			folders = append(folders, Folder{
				Name: getName(folderPath),
				Path: folderPath,
			})
			resp, err := c.listFolders(ctx, obj.Key)

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

func (c cdkBlobStorage) ListFolders(ctx context.Context, parentFolderPath string) ([]Folder, error) {
	folders, err := c.listFolders(ctx, c.getPrefix(parentFolderPath))
	return folders, err
}

func (c cdkBlobStorage) CreateFolder(ctx context.Context, parentFolderPath string, folderName string) error {
	//TODO implement me
	panic("implement me")
}

func (c cdkBlobStorage) DeleteFolder(ctx context.Context, folderPath string) error {
	//TODO implement me
	panic("implement me")
}
