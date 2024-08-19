package schedule

import (
	"errors"
	"sync"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	errRuleDeleted   = errors.New("rule deleted")
	errRuleRestarted = errors.New("rule restarted")
)

// folderCache is an in-memory cache for folder titles.
//
// Because the cache is updated in a single transaction, we only need to ensure access to the map is safe.
type folderCache struct {
	folders map[models.FolderKey]string
	mu      sync.Mutex
}

func newFolderCache() folderCache {
	return folderCache{folders: make(map[models.FolderKey]string)}
}

func (f *folderCache) replace(folders map[models.FolderKey]string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.folders = make(map[models.FolderKey]string, len(folders))
	for k, v := range folders {
		f.folders[k] = v
	}
}

func (f *folderCache) get(key models.FolderKey) (string, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	title, ok := f.folders[key]
	return title, ok
}

// ruleCache is an in-memory cache for alert rules.
type ruleCache struct {
	scheduleKeys map[models.AlertRuleScheduleKey]struct{}
	mu           sync.Mutex
}

func newRuleCache() ruleCache {
	return ruleCache{}
}

// update updates the rule cache with the provided schedule keys. It returns whether the cache was updated.
//
// This effectively inform us of rule changes since the provided keys should differ from the cache
// if any rule is added, removed, or updated. This does not indicate if the changes should trigger a group
// to be rescheduled.
func (r *ruleCache) update(keys []models.AlertRuleScheduleKey) (updated bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	tmp := make(map[models.AlertRuleScheduleKey]struct{}, len(keys))
	for _, key := range keys {
		tmp[key] = struct{}{}
		if _, ok := r.scheduleKeys[key]; !ok {
			r.scheduleKeys[key] = struct{}{}
			updated = true
		}
	}

	for key := range r.scheduleKeys {
		if _, ok := tmp[key]; !ok {
			delete(r.scheduleKeys, key)
			updated = true
		}
	}

	return updated
}

type groupCache struct {
	groups map[models.AlertRuleGroupKey]*Group
	mu     sync.Mutex
}

func newGroupReg() groupCache {
	return groupCache{groups: make(map[models.AlertRuleGroupKey]*Group)}
}

func (r *groupCache) get(k models.AlertRuleGroupKey) (*Group, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	group, ok := r.groups[k]
	return group, ok
}

func (r *groupCache) delete(k models.AlertRuleGroupKey) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.groups, k)
}

func (r *groupCache) all() []*Group {
	r.mu.Lock()
	defer r.mu.Unlock()
	result := make([]*Group, 0, len(r.groups))
	for _, group := range r.groups {
		result = append(result, group)
	}
	return result
}

func (r *groupCache) replace(groups map[models.AlertRuleGroupKey]*Group) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.groups = make(map[models.AlertRuleGroupKey]*Group, len(groups))
	for k, v := range groups {
		r.groups[k] = v
	}
}

func (r *groupCache) empty() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.groups) == 0
}
