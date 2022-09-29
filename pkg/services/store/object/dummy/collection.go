package objectdummyserver

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type collection[T any] interface {
	Load(ctx context.Context, orgID int64) ([]T, error)
	Save(ctx context.Context, orgID int64, coll []T) error
}

// generic collection stored in a single file in the `data` folder
type localFsCollection[T any] struct {
	version        int
	name           string
	collectionsDir string
}

func newCollection[T any](name string, dataPath string, version int) collection[T] {
	c := &localFsCollection[T]{
		name:           name,
		version:        version,
		collectionsDir: filepath.Join(dataPath, "file-collections"),
	}
	err := c.createCollectionsDirectory()
	if err != nil {
		panic(err)
	}
	return c
}

type CollectionFileContents[T any] struct {
	Version int `json:"version"`
	Items   []T `json:"items"`
}

func (s *localFsCollection[T]) collectionFilePath(orgID int64) string {
	return filepath.Join(s.collectionsDir, fmt.Sprintf("%s-orgId-%d.json", s.name, orgID))
}

func (s *localFsCollection[T]) Load(ctx context.Context, orgID int64) ([]T, error) {
	filePath := s.collectionFilePath(orgID)
	// Safe to ignore gosec warning G304.
	// nolint:gosec
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return []T{}, nil
		}
		return nil, fmt.Errorf("can't read %s file: %w", filePath, err)
	}
	var db CollectionFileContents[T]
	if err = json.Unmarshal(bytes, &db); err != nil {
		return nil, fmt.Errorf("can't unmarshal %s data: %w", filePath, err)
	}

	if db.Version != s.version {
		if err := s.Save(ctx, orgID, []T{}); err != nil {
			return nil, err
		}

		return []T{}, nil
	}

	return db.Items, nil
}

func (s *localFsCollection[T]) Save(_ context.Context, orgID int64, items []T) error {
	filePath := s.collectionFilePath(orgID)

	bytes, err := json.MarshalIndent(&CollectionFileContents[T]{
		Version: s.version,
		Items:   items,
	}, "", "  ")
	if err != nil {
		return fmt.Errorf("can't marshal items: %w", err)
	}

	return os.WriteFile(filePath, bytes, 0600)
}

func (s *localFsCollection[T]) createCollectionsDirectory() error {
	_, err := os.Stat(s.collectionsDir)
	if os.IsNotExist(err) {
		return os.Mkdir(s.collectionsDir, 0750)
	}

	return err
}
