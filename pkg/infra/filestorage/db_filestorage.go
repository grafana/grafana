package filestorage

import (
	"context"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type file struct {
	Path             string    `xorm:"path"`
	ParentFolderPath string    `xorm:"parent_folder_path"`
	Contents         []byte    `xorm:"contents"`
	Updated          time.Time `xorm:"updated"`
	Created          time.Time `xorm:"created"`
	Size             int64     `xorm:"size"`
	MimeType         string    `xorm:"mime_type"`
}

type fileMeta struct {
	Path  string `xorm:"path"`
	Key   string `xorm:"key"`
	Value string `xorm:"value"`
}

type dbFileStorage struct {
	db  *sqlstore.SQLStore
	log log.Logger
}

func NewDbStorage(log log.Logger, db *sqlstore.SQLStore, pathFilters *PathFilters, rootFolder string) FileStorage {
	return newWrapper(log, &dbFileStorage{
		log: log,
		db:  db,
	}, pathFilters, rootFolder)
}

func (s dbFileStorage) getProperties(sess *sqlstore.DBSession, lowerCasePaths []string) (map[string]map[string]string, error) {
	attributesByPath := make(map[string]map[string]string)

	entities := make([]*fileMeta, 0)
	if err := sess.Table("file_meta").In("path", lowerCasePaths).Find(&entities); err != nil {
		return nil, err
	}

	for _, entity := range entities {
		if _, ok := attributesByPath[entity.Path]; !ok {
			attributesByPath[entity.Path] = make(map[string]string)
		}
		attributesByPath[entity.Path][entity.Key] = entity.Value
	}

	return attributesByPath, nil
}

func (s dbFileStorage) Get(ctx context.Context, filePath string) (*File, error) {
	var result *File
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		table := &file{}
		exists, err := sess.Table("file").Where("LOWER(path) = ?", strings.ToLower(filePath)).Get(table)
		if !exists {
			return nil
		}

		var meta = make([]*fileMeta, 0)
		if err := sess.Table("file_meta").Where("path = ?", strings.ToLower(filePath)).Find(&meta); err != nil {
			return err
		}

		var metaProperties = make(map[string]string, len(meta))

		for i := range meta {
			metaProperties[meta[i].Key] = meta[i].Value
		}

		contents := table.Contents
		if contents == nil {
			contents = make([]byte, 0)
		}

		result = &File{
			Contents: contents,
			FileMetadata: FileMetadata{
				Name:       getName(table.Path),
				FullPath:   table.Path,
				Created:    table.Created,
				Properties: metaProperties,
				Modified:   table.Updated,
				Size:       table.Size,
				MimeType:   table.MimeType,
			},
		}
		return err
	})

	return result, err
}

func (s dbFileStorage) Delete(ctx context.Context, filePath string) error {
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		table := &file{}
		exists, innerErr := sess.Table("file").Where("LOWER(path) = ?", strings.ToLower(filePath)).Get(table)
		if innerErr != nil {
			return innerErr
		}

		if !exists {
			return nil
		}

		number, innerErr := sess.Table("file").Where("LOWER(path) = ?", strings.ToLower(filePath)).Delete(table)
		if innerErr != nil {
			return innerErr
		}
		s.log.Info("Deleted file", "path", filePath, "affectedRecords", number)

		metaTable := &fileMeta{}
		number, innerErr = sess.Table("file_meta").Where("path = ?", strings.ToLower(filePath)).Delete(metaTable)
		if innerErr != nil {
			return innerErr
		}
		s.log.Info("Deleted metadata", "path", filePath, "affectedRecords", number)
		return innerErr
	})

	return err
}

func (s dbFileStorage) Upsert(ctx context.Context, cmd *UpsertFileCommand) error {
	now := time.Now()
	err := s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		existing := &file{}
		exists, err := sess.Table("file").Where("LOWER(path) = ?", strings.ToLower(cmd.Path)).Get(existing)
		if err != nil {
			return err
		}

		if exists {
			existing.Updated = now
			if cmd.Contents != nil {
				contents := *cmd.Contents
				existing.Contents = contents
				existing.MimeType = cmd.MimeType
				existing.Size = int64(len(contents))
			}

			_, err = sess.Where("LOWER(path) = ?", strings.ToLower(cmd.Path)).Update(existing)
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
				ParentFolderPath: strings.ToLower(getParentFolderPath(cmd.Path)),
				Contents:         contentsToInsert,
				MimeType:         cmd.MimeType,
				Size:             int64(len(contentsToInsert)),
				Updated:          now,
				Created:          now,
			}
			_, err := sess.Insert(file)
			if err != nil {
				return err
			}
		}

		if len(cmd.Properties) != 0 {
			if err = upsertProperties(sess, now, cmd); err != nil {
				if rollbackErr := sess.Rollback(); rollbackErr != nil {
					s.log.Error("failed while rolling back upsert", "path", cmd.Path)
				}
				return err
			}
		}

		return err
	})

	return err
}

func upsertProperties(sess *sqlstore.DBSession, now time.Time, cmd *UpsertFileCommand) error {
	fileMeta := &fileMeta{}
	_, err := sess.Table("file_meta").Where("path = ?", strings.ToLower(cmd.Path)).Delete(fileMeta)
	if err != nil {
		return err
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
	exists, err := sess.Table("file_meta").Where("path = ? AND key = ?", strings.ToLower(path), key).Get(existing)
	if err != nil {
		return err
	}

	if exists {
		existing.Value = val
		_, err = sess.Where("path = ? AND key = ?", strings.ToLower(path), key).Update(existing)
	} else {
		_, err = sess.Insert(&fileMeta{
			Path:  strings.ToLower(path),
			Key:   key,
			Value: val,
		})
	}
	return err
}

//nolint: gocyclo
func (s dbFileStorage) List(ctx context.Context, folderPath string, paging *Paging, options *ListOptions) (*ListResponse, error) {
	var resp *ListResponse

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		cursor := ""
		if paging != nil && paging.After != "" {
			exists, err := sess.Table("file").Where("LOWER(path) = ?", strings.ToLower(paging.After)+Delimiter).Cols("mime_type").Exist()
			if err != nil {
				return err
			}
			if exists {
				cursor = paging.After + Delimiter
			} else {
				cursor = paging.After
			}
		}

		var foundFiles = make([]*file, 0)
		sess.Table("file")
		lowerFolderPrefix := ""
		lowerFolderPath := strings.ToLower(folderPath)
		if lowerFolderPath == "" || lowerFolderPath == Delimiter {
			lowerFolderPrefix = Delimiter
			lowerFolderPath = Delimiter
		} else {
			lowerFolderPath = strings.TrimSuffix(lowerFolderPath, Delimiter)
			lowerFolderPrefix = lowerFolderPath + Delimiter
		}

		sess.Where("LOWER(path) != ?", lowerFolderPrefix)

		if !options.Recursive {
			sess.Where("parent_folder_path = ?", lowerFolderPath)
		} else {
			sess.Where("(parent_folder_path = ?) OR (parent_folder_path LIKE ?)", lowerFolderPath, lowerFolderPrefix+"%")
		}

		if !options.WithFolders && options.WithFiles {
			sess.Where("path NOT LIKE ?", "%/")
		}

		if options.WithFolders && !options.WithFiles {
			sess.Where("path LIKE ?", "%/")
		}

		if len(options.PathFilters.allowedPrefixes)+len(options.PathFilters.allowedPaths) > 0 {
			queries := make([]string, 0)
			args := make([]interface{}, 0)
			for _, prefix := range options.PathFilters.allowedPrefixes {
				queries = append(queries, "LOWER(path) LIKE ?")
				args = append(args, prefix+"%")
			}

			for _, path := range options.PathFilters.allowedPaths {
				queries = append(queries, "LOWER(path) = ?")
				args = append(args, path)
			}
			sess.Where(strings.Join(queries, " OR "), args...)
		}

		if options.PathFilters.disallowedPrefixes != nil && len(options.PathFilters.disallowedPrefixes) > 0 {
			queries := make([]string, 0)
			args := make([]interface{}, 0)
			for _, prefix := range options.PathFilters.disallowedPrefixes {
				queries = append(queries, "LOWER(path) NOT LIKE ?")
				args = append(args, prefix+"%")
			}
			sess.Where(strings.Join(queries, " AND "), args...)
		}

		if options.PathFilters.disallowedPaths != nil && len(options.PathFilters.disallowedPaths) > 0 {
			queries := make([]string, 0)
			args := make([]interface{}, 0)
			for _, path := range options.PathFilters.disallowedPaths {
				queries = append(queries, "LOWER(path) != ?")
				args = append(args, path)
			}
			sess.Where(strings.Join(queries, " AND "), args...)
		}

		sess.OrderBy("path")

		pageSize := paging.First
		sess.Limit(pageSize + 1)

		if cursor != "" {
			sess.Where("path > ?", cursor)
		}

		if err := sess.Find(&foundFiles); err != nil {
			return err
		}

		foundLength := len(foundFiles)
		if foundLength > pageSize {
			foundLength = pageSize
		}

		lowerCasePaths := make([]string, 0)
		for i := 0; i < foundLength; i++ {
			isFolder := strings.HasSuffix(foundFiles[i].Path, Delimiter)
			if !isFolder {
				lowerCasePaths = append(lowerCasePaths, strings.ToLower(foundFiles[i].Path))
			}
		}
		propertiesByLowerPath, err := s.getProperties(sess, lowerCasePaths)
		if err != nil {
			return err
		}

		files := make([]*File, 0)
		for i := 0; i < foundLength; i++ {
			var props map[string]string
			path := strings.TrimSuffix(foundFiles[i].Path, Delimiter)
			if foundProps, ok := propertiesByLowerPath[strings.ToLower(path)]; ok {
				props = foundProps
			} else {
				props = make(map[string]string)
			}

			var contents []byte
			if options.WithContents {
				contents = foundFiles[i].Contents
			} else {
				contents = []byte{}
			}
			files = append(files, &File{Contents: contents, FileMetadata: FileMetadata{
				Name:       getName(path),
				FullPath:   path,
				Created:    foundFiles[i].Created,
				Properties: props,
				Modified:   foundFiles[i].Updated,
				Size:       foundFiles[i].Size,
				MimeType:   foundFiles[i].MimeType,
			}})
		}

		lastPath := ""
		if len(files) > 0 {
			lastPath = files[len(files)-1].FullPath
		}

		resp = &ListResponse{
			Files:    files,
			LastPath: lastPath,
			HasMore:  len(foundFiles) == pageSize+1,
		}
		return nil
	})

	return resp, err
}

func (s dbFileStorage) CreateFolder(ctx context.Context, path string) error {
	now := time.Now()
	precedingFolders := precedingFolders(path)

	err := s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var insertErr error
		sess.MustLogSQL(true)
		previousFolder := Delimiter
		for i := 0; i < len(precedingFolders); i++ {
			existing := &file{}
			currentFolderParentPath := previousFolder
			previousFolder = Join(previousFolder, getName(precedingFolders[i]))
			currentFolderPath := previousFolder
			if !strings.HasSuffix(currentFolderPath, Delimiter) {
				currentFolderPath = currentFolderPath + Delimiter
			}
			exists, err := sess.Table("file").Where("LOWER(path) = ?", strings.ToLower(currentFolderPath)).Get(existing)
			if err != nil {
				insertErr = err
				break
			}

			if exists {
				previousFolder = strings.TrimSuffix(existing.Path, Delimiter)
				continue
			}

			file := &file{
				Path:             currentFolderPath,
				ParentFolderPath: strings.ToLower(currentFolderParentPath),
				Contents:         make([]byte, 0),
				Updated:          now,
				MimeType:         DirectoryMimeType,
				Created:          now,
			}
			_, err = sess.Insert(file)
			if err != nil {
				insertErr = err
				break
			}
			s.log.Info("Created folder", "markerPath", file.Path, "parent", file.ParentFolderPath)
		}

		if insertErr != nil {
			if rollErr := sess.Rollback(); rollErr != nil {
				return errutil.Wrapf(insertErr, "Rolling back transaction due to error failed: %s", rollErr)
			}
			return insertErr
		}

		return sess.Commit()
	})

	return err
}

func (s dbFileStorage) DeleteFolder(ctx context.Context, folderPath string) error {
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		existing := &file{}
		internalFolderPath := strings.ToLower(folderPath) + Delimiter
		exists, err := sess.Table("file").Where("LOWER(path) = ?", internalFolderPath).Get(existing)
		if err != nil {
			return err
		}

		if !exists {
			return nil
		}

		_, err = sess.Table("file").Where("LOWER(path) = ?", internalFolderPath).Delete(existing)
		return err
	})

	return err
}

func (s dbFileStorage) close() error {
	return nil
}
