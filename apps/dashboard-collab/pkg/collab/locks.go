package collab

import "sync"

// LockTable manages panel-level soft locks for a collaboration session.
// A panel can only be locked by one user at a time. A user can hold
// multiple locks (e.g., editing multiple panels via split view).
type LockTable struct {
	locks map[string]string // target → userId
	mu    sync.RWMutex
}

// NewLockTable creates an empty lock table.
func NewLockTable() *LockTable {
	return &LockTable{
		locks: make(map[string]string),
	}
}

// Acquire attempts to lock a target for the given user.
// Returns (true, userId) if granted (including idempotent re-lock by same user).
// Returns (false, currentHolder) if the target is already locked by another user.
func (lt *LockTable) Acquire(target, userId string) (granted bool, holder string) {
	lt.mu.Lock()
	defer lt.mu.Unlock()

	if current, ok := lt.locks[target]; ok {
		if current == userId {
			return true, userId // idempotent
		}
		return false, current
	}

	lt.locks[target] = userId
	return true, userId
}

// Release removes a lock on a target, but only if it is held by the given user.
// Returns true if the lock was released, false if not held or held by another user.
func (lt *LockTable) Release(target, userId string) bool {
	lt.mu.Lock()
	defer lt.mu.Unlock()

	if current, ok := lt.locks[target]; ok && current == userId {
		delete(lt.locks, target)
		return true
	}
	return false
}

// ReleaseAll removes all locks held by the given user.
// Returns the list of targets that were released. Called on user disconnect.
func (lt *LockTable) ReleaseAll(userId string) []string {
	lt.mu.Lock()
	defer lt.mu.Unlock()

	var released []string
	for target, holder := range lt.locks {
		if holder == userId {
			delete(lt.locks, target)
			released = append(released, target)
		}
	}
	return released
}

// Snapshot returns a copy of the current lock state (target → userId).
// Used to send lock state to newly joining users.
func (lt *LockTable) Snapshot() map[string]string {
	lt.mu.RLock()
	defer lt.mu.RUnlock()

	snap := make(map[string]string, len(lt.locks))
	for target, userId := range lt.locks {
		snap[target] = userId
	}
	return snap
}
