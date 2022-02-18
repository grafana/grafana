package filestorage

import (
	"context"
	"fmt"
	"io"

	"github.com/grafana/grafana/pkg/infra/log"
	"gocloud.dev/blob"
	"gocloud.dev/gcerrors"
)

type cdkBlobStorage struct {
	log    log.Logger
	bucket *blob.Bucket
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

	hasMore := true
	var files []FileMetadata
	for {
		if len(files) >= pageSize {
			_, err := iterator.Next(ctx)
			if err == io.EOF {
				hasMore = false
			}

			break
		}

		obj, err := iterator.Next(ctx)
		if err == io.EOF {
			hasMore = false
			break
		}
		path := obj.Key

		if err != nil {
			c.log.Error("Failed while iterating over files", "err", err)
			return nil, err
		}

		if obj.IsDir && recursive {
			newPageSize := pageSize - len(files)
			resp, err := c.listFiles(ctx, path, true, &Paging{
				First: newPageSize,
			})

			if err != nil {
				return nil, err
			}

			files = append(files, resp.Files...)
			if len(files) >= pageSize {
				hasMore = resp.HasMore
			}
		} else if !obj.IsDir {
			attributes, err := c.bucket.Attributes(ctx, path)
			if err != nil {
				c.log.Error("Failed while retrieving attributes", "path", path, "err", err)
				return nil, err
			}

			files = append(files, FileMetadata{
				Name:       getName(path),
				FullPath:   path,
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

func (c cdkBlobStorage) ListFiles(ctx context.Context, folderPath string, recursive bool, paging *Paging) (*ListFilesResponse, error) {
	return c.listFiles(ctx, fmt.Sprintf("%s%s", folderPath, Delimiter), recursive, paging)
}

func (c cdkBlobStorage) ListFolders(ctx context.Context, parentFolderPath string) (*[]Folder, error) {
	//TODO implement me
	panic("implement me")
}

func (c cdkBlobStorage) CreateFolder(ctx context.Context, parentFolderPath string, folderName string) error {
	//TODO implement me
	panic("implement me")
}

func (c cdkBlobStorage) DeleteFolder(ctx context.Context, folderPath string) error {
	//TODO implement me
	panic("implement me")
}
