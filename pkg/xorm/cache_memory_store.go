// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"sync"

	"xorm.io/core"
)

var _ core.CacheStore = NewMemoryStore()

// MemoryStore represents in-memory store
type MemoryStore struct {
	store map[interface{}]interface{}
	mutex sync.RWMutex
}

// NewMemoryStore creates a new store in memory
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{store: make(map[interface{}]interface{})}
}

// Put puts object into store
func (s *MemoryStore) Put(key string, value interface{}) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	s.store[key] = value
	return nil
}

// Get gets object from store
func (s *MemoryStore) Get(key string) (interface{}, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	if v, ok := s.store[key]; ok {
		return v, nil
	}

	return nil, ErrNotExist
}

// Del deletes object
func (s *MemoryStore) Del(key string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	delete(s.store, key)
	return nil
}
