package localcache

import (
	"sync"
	"time"

	gocache "github.com/patrickmn/go-cache"
)

// lockableEntry is used in the `Exclusive*` functions provided by the
// `CacheService`. The mutex protects concurrent writes to the same cache
// key.
type lockableEntry struct {
	sync.Mutex
	holds int // how many attempted holds on this cache entry
}

// CacheService cache any object in memory on the local instance.
type CacheService struct {
	*gocache.Cache

	// Used in `Exclusive*` functions.
	mu    sync.Mutex                // protects access to `locks` map
	locks map[string]*lockableEntry // maps `key` to corresponding lock
}

func ProvideService() *CacheService {
	return New(5*time.Minute, 10*time.Minute)
}

// New returns a new CacheService
func New(defaultExpiration, cleanupInterval time.Duration) *CacheService {
	return &CacheService{
		Cache: gocache.New(defaultExpiration, cleanupInterval),
		locks: make(map[string]*lockableEntry),
	}
}

func (s *CacheService) ExclusiveSet(key string, getValue func() (any, error), dur time.Duration) error {
	unlock := s.Lock(key)
	defer unlock()

	v, err := getValue()
	if err != nil {
		return err
	}

	s.Set(key, v, dur)
	return nil
}

func (s *CacheService) ExclusiveDelete(key string) {
	unlock := s.Lock(key)
	defer unlock()

	s.Delete(key)
}

// Lock locks the entry associated with the given key, returning the function
// the should be called to unlock it.
func (s *CacheService) Lock(key string) func() {
	// Create an entry in the `locks` mapping if non-existent, and increase
	// the number of holds.
	s.mu.Lock()
	entry, ok := s.locks[key]
	if !ok {
		entry = &lockableEntry{}
		s.locks[key] = entry
	}
	entry.holds += 1
	s.mu.Unlock()

	entry.Lock()

	// Unlock function: if no one is attempting to hold a lock to this entry
	// anymore, it is safe to delete it.
	return func() {
		entry.Unlock()

		s.mu.Lock()
		entry.holds -= 1
		if entry.holds == 0 {
			delete(s.locks, key)
		}
		s.mu.Unlock()
	}
}
