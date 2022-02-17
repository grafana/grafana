package filestorage

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type file struct {
	Path             string    `xorm:"path"`
	ParentFolderPath string    `xorm:"parent_folder_path"`
	Contents         []byte    `xorm:"contents"`
	Updated          time.Time `xorm:"updated"`
	Created          time.Time `xorm:"created"`
}

type fileMeta struct {
	Path    string    `xorm:"path"`
	Key     string    `xorm:"key"`
	Value   string    `xorm:"value"`
	Updated time.Time `xorm:"updated"`
	Created time.Time `xorm:"created"`
}

type dbFileStorage struct {
	db  *sqlstore.SQLStore
	log log.Logger
}

func (s dbFileStorage) Get(ctx context.Context, filePath string) (*File, error) {
	var result *File
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		table := &file{}
		exists, err := sess.Table("file").Where("LOWER(path) = ?", filePath).Get(table)
		if !exists {
			return nil
		}

		var meta = make([]*fileMeta, 0)
		if err := sess.Table("file_meta").Where("LOWER(path) = ?", filePath).Find(&meta); err != nil {
			return err
		}

		var metaProperties = make(map[string]string, len(meta))

		for i := range meta {
			metaProperties[meta[i].Key] = meta[i].Value
		}

		result = &File{
			Contents: table.Contents,
			FileMetadata: FileMetadata{
				Name:       extractName(filePath),
				FullPath:   filePath,
				Created:    table.Created,
				Properties: metaProperties,
			},
		}
		return err
	})

	return result, err
}

func (s dbFileStorage) Delete(ctx context.Context, filePath string) error {
	//TODO implement me
	panic("implement me")
}

func (s dbFileStorage) Upsert(ctx context.Context, cmd *UpsertFileCommand) error {
	now := time.Now()
	err := s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		existing := &file{}
		exists, err := sess.Table("file").Where("LOWER(path) = ?", cmd.Path).Get(existing)

		if exists {
			existing.Updated = now
			if cmd.Contents != nil {
				existing.Contents = *cmd.Contents
			}

			_, err = sess.Where("LOWER(path) = ?", cmd.Path).Update(existing)
			if err != nil {
				return err
			}
		} else {
			contentsToInsert := make([]byte, 0)
			if cmd.Contents != nil {
				contentsToInsert = *cmd.Contents
			}

			file := &file{
				Path:             cmd.Path,
				ParentFolderPath: getParentFolderPath(cmd.Path),
				Contents:         contentsToInsert,
				Updated:          now,
				Created:          now,
			}
			_, err := sess.Insert(file)
			if err != nil {
				return err
			}
		}

		err = upsertProperties(sess, now, cmd)
		if err != nil {
			if rollbackErr := sess.Rollback(); rollbackErr != nil {
				s.log.Error("failed while rolling back upsert", "path", cmd.Path)
			}
			return err
		}
		return err
	})

	return err
}

func upsertProperties(sess *sqlstore.DBSession, now time.Time, cmd *UpsertFileCommand) error {
	if len(cmd.Properties) == 0 {
		return nil
	}

	for key, val := range cmd.Properties {
		if err := upsertProperty(sess, now, cmd.Path, key, val); err != nil {
			return err
		}
	}
	return nil
}

func upsertProperty(sess *sqlstore.DBSession, now time.Time, path string, key string, val string) error {
	existing := &fileMeta{}
	exists, err := sess.Table("file_meta").Where("LOWER(path) = ? AND key = ?", path, key).Get(existing)
	if err != nil {
		return err
	}

	if exists {
		existing.Updated = now
		existing.Value = val
		_, err = sess.Where("LOWER(path) = ? AND key = ?", path, key).Update(existing)
	} else {
		_, err = sess.Insert(&fileMeta{
			Path:    path,
			Key:     key,
			Value:   val,
			Updated: now,
			Created: now,
		})
	}
	return err
}

func (s dbFileStorage) ListFiles(ctx context.Context, folderPath string, recursive bool, cursor *Cursor) (*ListFilesResponse, error) {
	var resp *ListFilesResponse

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var foundFiles = make([]*file, 0)

		sess.Table("file")
		if recursive {
			sess.Where("LOWER(parent_folder_path) LIKE ?", fmt.Sprintf("%s%s", folderPath, "%"))
		} else {
			sess.Where("LOWER(parent_folder_path) = ?", folderPath)
		}
		sess.OrderBy("path")

		if err := sess.Find(&foundFiles); err != nil {
			return err
		}

		files := make([]FileMetadata, 0)
		for i := range foundFiles {
			files = append(files, FileMetadata{
				Name:       extractName(foundFiles[i].Path),
				FullPath:   foundFiles[i].Path,
				Created:    foundFiles[i].Created,
				Properties: make(map[string]string, 0),
			})
		}

		resp = &ListFilesResponse{
			Files: files,
		}
		return nil
	})

	return resp, err
}

func (s dbFileStorage) ListFolders(ctx context.Context, parentFolderPath string) (*[]Folder, error) {
	//TODO implement me
	panic("implement me")
}

func (s dbFileStorage) CreateFolder(ctx context.Context, parentFolderPath string, folderName string) error {
	//TODO implement me
	panic("implement me")
}

func (s dbFileStorage) DeleteFolder(ctx context.Context, folderPath string) error {
	//TODO implement me
	panic("implement me")
}
