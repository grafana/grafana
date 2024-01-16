package persistentcollection

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

func NewLocalFSPersistentCollection[T any](name string, directory string, version int) PersistentCollection[T] {
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

type localFsCollection[T any] struct {
	version        int
	name           string
	collectionsDir string
	mu             sync.Mutex
}

func (s *localFsCollection[T]) Insert(ctx context.Context, namespace string, item T) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load(ctx, namespace)
	if err != nil {
		return err
	}

	return s.save(ctx, namespace, append(items, item))
}

func (s *localFsCollection[T]) Delete(ctx context.Context, namespace string, predicate Predicate[T]) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load(ctx, namespace)
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
		return deletedCount, s.save(ctx, namespace, newItems)
	}

	return deletedCount, nil
}

func (s *localFsCollection[T]) FindFirst(ctx context.Context, namespace string, predicate Predicate[T]) (T, error) {
	var nilResult T

	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load(ctx, namespace)
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

func (s *localFsCollection[T]) Find(ctx context.Context, namespace string, predicate Predicate[T]) ([]T, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load(ctx, namespace)
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

func (s *localFsCollection[T]) Update(ctx context.Context, namespace string, updateFn UpdateFn[T]) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load(ctx, namespace)
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
		return updatedCount, s.save(ctx, namespace, newItems)
	}

	return updatedCount, nil
}

func (s *localFsCollection[T]) load(ctx context.Context, namespace string) ([]T, error) {
	filePath := s.collectionFilePath(namespace)
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
		if err := s.save(ctx, namespace, []T{}); err != nil {
			return nil, err
		}

		return []T{}, nil
	}

	return db.Items, nil
}

func (s *localFsCollection[T]) save(_ context.Context, namespace string, items []T) error {
	filePath := s.collectionFilePath(namespace)

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
		return os.MkdirAll(s.collectionsDir, 0750)
	}

	return err
}

func (s *localFsCollection[T]) collectionFilePath(namespace string) string {
	return filepath.Join(s.collectionsDir, fmt.Sprintf("%s-namespace-%s.json", s.name, namespace))
}
