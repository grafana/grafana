package objectdummyserver

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type predicate[T any] func(item T) (bool, error)
type updateFn[T any] func(item T) (updated bool, updatedItem T, err error)

type persistentCollection[T any] interface {
	Delete(ctx context.Context, orgID int64, predicate predicate[T]) (deletedCount int, err error)
	FindFirst(ctx context.Context, orgID int64, predicate predicate[T]) (T, error)
	Find(ctx context.Context, orgID int64, predicate predicate[T]) ([]T, error)
	Update(ctx context.Context, orgID int64, updateFn updateFn[T]) (updatedCount int, err error)
	Insert(ctx context.Context, orgID int64, item T) error

	load(ctx context.Context, orgID int64) ([]T, error)
	save(ctx context.Context, orgID int64, coll []T) error
}

func newLocalFsCollection[T any](name string, directory string, version int) persistentCollection[T] {
	c := &localFsCollection[T]{
		name:           name,
		version:        version,
		collectionsDir: filepath.Join(directory, "file-collections"),
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

// generic persistentCollection stored in a single file in the `data` folder
type localFsCollection[T any] struct {
	version        int
	name           string
	collectionsDir string
	mu             sync.Mutex
}

func (s *localFsCollection[T]) Insert(ctx context.Context, orgID int64, item T) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load(ctx, orgID)
	if err != nil {
		return err
	}

	return s.save(ctx, orgID, append(items, item))
}

func (s *localFsCollection[T]) Delete(ctx context.Context, orgID int64, predicate predicate[T]) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load(ctx, orgID)
	if err != nil {
		return 0, err
	}

	deletedCount := 0
	newItems := make([]T, 0)
	for idx := range items {
		del, err := predicate(items[idx])
		if err != nil {
			return deletedCount, err
		}

		if del {
			deletedCount += 1
		} else {
			newItems = append(newItems, items[idx])
		}
	}

	if deletedCount != 0 {
		return deletedCount, s.save(ctx, orgID, newItems)
	}

	return deletedCount, nil
}

func (s *localFsCollection[T]) FindFirst(ctx context.Context, orgID int64, predicate predicate[T]) (T, error) {
	var nilResult T

	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load(ctx, orgID)
	if err != nil {
		return nilResult, err
	}

	for idx := range items {
		match, err := predicate(items[idx])
		if err != nil {
			return nilResult, err
		}
		if match {
			return items[idx], nil
		}
	}

	return nilResult, nil
}

func (s *localFsCollection[T]) Find(ctx context.Context, orgID int64, predicate predicate[T]) ([]T, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load(ctx, orgID)
	if err != nil {
		return nil, err
	}

	result := make([]T, 0)
	for idx := range items {
		match, err := predicate(items[idx])
		if err != nil {
			return nil, err
		}

		if match {
			result = append(result, items[idx])
		}
	}

	return result, nil
}

func (s *localFsCollection[T]) Update(ctx context.Context, orgID int64, updateFn updateFn[T]) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load(ctx, orgID)
	if err != nil {
		return 0, err
	}

	newItems := make([]T, 0)
	updatedCount := 0
	for idx := range items {
		updated, updatedItem, err := updateFn(items[idx])
		if err != nil {
			return updatedCount, err
		}

		if updated {
			updatedCount += 1
			newItems = append(newItems, updatedItem)
		} else {
			newItems = append(newItems, items[idx])
		}
	}

	if updatedCount != 0 {
		return updatedCount, s.save(ctx, orgID, newItems)
	}

	return updatedCount, nil
}

func (s *localFsCollection[T]) load(ctx context.Context, orgID int64) ([]T, error) {
	filePath := s.collectionFilePath(orgID)
	// Safe to ignore gosec warning G304, the path comes from grafana settings rather than the user input
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
		if err := s.save(ctx, orgID, []T{}); err != nil {
			return nil, err
		}

		return []T{}, nil
	}

	return db.Items, nil
}

func (s *localFsCollection[T]) save(_ context.Context, orgID int64, items []T) error {
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

func (s *localFsCollection[T]) collectionFilePath(orgID int64) string {
	return filepath.Join(s.collectionsDir, fmt.Sprintf("%s-orgId-%d.json", s.name, orgID))
}
