package postgres

import (
	"fmt"
	"sync"
)

// locker is a named reader/writer mutual exclusion lock.
// The lock for each particular key can be held by an arbitrary number of readers or a single writer.
type locker struct {
	locks   map[any]*sync.RWMutex
	locksRW *sync.RWMutex
}

func newLocker() *locker {
	return &locker{
		locks:   make(map[any]*sync.RWMutex),
		locksRW: new(sync.RWMutex),
	}
}

// Lock locks named rw mutex with specified key for writing.
// If the lock with the same key is already locked for reading or writing,
// Lock blocks until the lock is available.
func (lkr *locker) Lock(key any) {
	lk, ok := lkr.getLock(key)
	if !ok {
		lk = lkr.newLock(key)
	}
	lk.Lock()
}

// Unlock unlocks named rw mutex with specified key for writing. It is a run-time error if rw is
// not locked for writing on entry to Unlock.
func (lkr *locker) Unlock(key any) {
	lk, ok := lkr.getLock(key)
	if !ok {
		panic(fmt.Errorf("lock for key '%s' not initialized", key))
	}
	lk.Unlock()
}

// RLock locks named rw mutex with specified key for reading.
//
// It should not be used for recursive read locking for the same key; a blocked Lock
// call excludes new readers from acquiring the lock. See the
// documentation on the golang RWMutex type.
func (lkr *locker) RLock(key any) {
	lk, ok := lkr.getLock(key)
	if !ok {
		lk = lkr.newLock(key)
	}
	lk.RLock()
}

// RUnlock undoes a single RLock call for specified key;
// it does not affect other simultaneous readers of locker for specified key.
// It is a run-time error if locker for specified key is not locked for reading
func (lkr *locker) RUnlock(key any) {
	lk, ok := lkr.getLock(key)
	if !ok {
		panic(fmt.Errorf("lock for key '%s' not initialized", key))
	}
	lk.RUnlock()
}

func (lkr *locker) newLock(key any) *sync.RWMutex {
	lkr.locksRW.Lock()
	defer lkr.locksRW.Unlock()

	if lk, ok := lkr.locks[key]; ok {
		return lk
	}
	lk := new(sync.RWMutex)
	lkr.locks[key] = lk
	return lk
}

func (lkr *locker) getLock(key any) (*sync.RWMutex, bool) {
	lkr.locksRW.RLock()
	defer lkr.locksRW.RUnlock()

	lock, ok := lkr.locks[key]
	return lock, ok
}
