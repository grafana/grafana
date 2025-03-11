package schedule

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"sort"
	"sync"
	"time"
	"unsafe"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	errRuleDeleted   = errors.New("rule deleted")
	errRuleRestarted = errors.New("rule restarted")
)

type ruleFactory interface {
	new(context.Context, *models.AlertRule) Rule
}

type ruleRegistry struct {
	mu    sync.Mutex
	rules map[models.AlertRuleKey]Rule
}

func newRuleRegistry() ruleRegistry {
	return ruleRegistry{rules: make(map[models.AlertRuleKey]Rule)}
}

// getOrCreate gets a rule routine from registry for the provided rule. If it does not exist, it creates a new one.
// Returns a pointer to the rule routine and a flag that indicates whether it is a new struct or not.
func (r *ruleRegistry) getOrCreate(context context.Context, item *models.AlertRule, factory ruleFactory) (Rule, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	key := item.GetKey()
	rule, ok := r.rules[key]
	if !ok {
		rule = factory.new(context, item)
		r.rules[key] = rule
	}
	return rule, !ok
}

func (r *ruleRegistry) exists(key models.AlertRuleKey) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, ok := r.rules[key]
	return ok
}

// get fetches a rule from the registry by key. It returns (rule, ok) where ok is false if the rule did not exist.
func (r *ruleRegistry) get(key models.AlertRuleKey) (Rule, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ru, ok := r.rules[key]
	return ru, ok
}

// del removes pair that has specific key from the registry.
// Returns 2-tuple where the first element is value of the removed pair
// and the second element indicates whether element with the specified key existed.
func (r *ruleRegistry) del(key models.AlertRuleKey) (Rule, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rule, ok := r.rules[key]
	if ok {
		delete(r.rules, key)
	}
	return rule, ok
}

func (r *ruleRegistry) keyMap() map[models.AlertRuleKey]struct{} {
	r.mu.Lock()
	defer r.mu.Unlock()
	definitionsIDs := make(map[models.AlertRuleKey]struct{}, len(r.rules))
	for k := range r.rules {
		definitionsIDs[k] = struct{}{}
	}
	return definitionsIDs
}

type Evaluation struct {
	scheduledAt time.Time
	rule        *models.AlertRule
	folderTitle string
	afterEval   func()
}

func (e *Evaluation) Fingerprint() fingerprint {
	return ruleWithFolder{e.rule, e.folderTitle}.Fingerprint()
}

type alertRulesRegistry struct {
	rules        map[models.AlertRuleKey]*models.AlertRule
	folderTitles map[models.FolderKey]string
	mu           sync.Mutex
}

// all returns all rules in the registry.
func (r *alertRulesRegistry) all() ([]*models.AlertRule, map[models.FolderKey]string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	result := make([]*models.AlertRule, 0, len(r.rules))
	for _, rule := range r.rules {
		result = append(result, rule)
	}
	return result, r.folderTitles
}

func (r *alertRulesRegistry) get(k models.AlertRuleKey) *models.AlertRule {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rules[k]
}

// set replaces all rules in the registry. Returns difference between previous and the new current version of the registry
func (r *alertRulesRegistry) set(rules []*models.AlertRule, folders map[models.FolderKey]string) diff {
	r.mu.Lock()
	defer r.mu.Unlock()
	rulesMap := make(map[models.AlertRuleKey]*models.AlertRule)
	for _, rule := range rules {
		rulesMap[rule.GetKey()] = rule
	}
	d := r.getDiff(rulesMap)
	r.rules = rulesMap
	// return the map as is without copying because it is not mutated
	r.folderTitles = folders
	return d
}

// update inserts or replaces a rule in the registry.
func (r *alertRulesRegistry) update(rule *models.AlertRule) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rules[rule.GetKey()] = rule
}

// del removes pair that has specific key from alertRulesRegistry.
// Returns 2-tuple where the first element is value of the removed pair
// and the second element indicates whether element with the specified key existed.
func (r *alertRulesRegistry) del(k models.AlertRuleKey) (*models.AlertRule, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rule, ok := r.rules[k]
	if ok {
		delete(r.rules, k)
	}
	return rule, ok
}

func (r *alertRulesRegistry) isEmpty() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.rules) == 0
}

func (r *alertRulesRegistry) needsUpdate(keys []models.AlertRuleKeyWithVersion) bool {
	if len(r.rules) != len(keys) {
		return true
	}
	for _, key := range keys {
		rule, ok := r.rules[key.AlertRuleKey]
		if !ok || rule.Version != key.Version {
			return true
		}
	}
	return false
}

type diff struct {
	updated map[models.AlertRuleKey]struct{}
}

func (d diff) IsEmpty() bool {
	return len(d.updated) == 0
}

// getDiff calculates difference between the list of rules fetched previously and provided keys. Returns diff where
// updated - a list of keys that exist in the registry but with different version,
func (r *alertRulesRegistry) getDiff(rules map[models.AlertRuleKey]*models.AlertRule) diff {
	result := diff{
		updated: map[models.AlertRuleKey]struct{}{},
	}
	for key, newRule := range rules {
		oldRule, ok := r.rules[key]
		if !ok || newRule.Version == oldRule.Version {
			// a new rule or not updated
			continue
		}
		result.updated[key] = struct{}{}
	}
	return result
}

type fingerprint uint64

func (f fingerprint) String() string {
	return fmt.Sprintf("%016x", uint64(f))
}

// fingerprintSeparator used during calculation of fingerprint to separate different fields. Contains a byte sequence that cannot happen in UTF-8 strings.
var fingerprintSeparator = []byte{255}

type ruleWithFolder struct {
	rule        *models.AlertRule
	folderTitle string
}

// fingerprint calculates a fingerprint that includes all fields except rule's Version and Update timestamp.
func (r ruleWithFolder) Fingerprint() fingerprint {
	rule := r.rule

	sum := fnv.New64()

	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		_, _ = sum.Write(fingerprintSeparator)
	}
	writeString := func(s string) {
		if len(s) == 0 {
			writeBytes(nil)
			return
		}
		// #nosec G103
		// avoid allocation when converting string to byte slice
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s)))
	}
	// this temp slice is used to convert ints to bytes.
	tmp := make([]byte, 8)
	writeInt := func(u int64) {
		binary.LittleEndian.PutUint64(tmp, uint64(u))
		writeBytes(tmp)
	}

	// allocate a slice that will be used for sorting keys, so we allocate it only once
	var keys []string
	maxLen := int(math.Max(math.Max(float64(len(rule.Annotations)), float64(len(rule.Labels))), float64(len(rule.Data))))
	if maxLen > 0 {
		keys = make([]string, maxLen)
	}

	writeLabels := func(lbls map[string]string) {
		// maps do not guarantee predictable sequence of keys.
		// Therefore, to make hash stable, we need to sort keys
		if len(lbls) == 0 {
			return
		}
		idx := 0
		for labelName := range lbls {
			keys[idx] = labelName
			idx++
		}
		sub := keys[:idx]
		sort.Strings(sub)
		for _, name := range sub {
			writeString(name)
			writeString(lbls[name])
		}
	}
	writeQuery := func() {
		// The order of queries is not important as they represent an expression tree.
		// Therefore, the order of elements should not change the hash. Sort by RefID because it is the unique key.
		for i, q := range rule.Data {
			keys[i] = q.RefID
		}
		sub := keys[:len(rule.Data)]
		sort.Strings(sub)
		for _, id := range sub {
			for _, q := range rule.Data {
				if q.RefID == id {
					writeString(q.RefID)
					writeString(q.DatasourceUID)
					writeString(q.QueryType)
					writeInt(int64(q.RelativeTimeRange.From))
					writeInt(int64(q.RelativeTimeRange.To))
					writeBytes(q.Model)
					break
				}
			}
		}
	}

	// fields that determine the rule state
	writeString(rule.UID)
	writeString(rule.Title)
	writeString(rule.NamespaceUID)
	writeString(r.folderTitle)
	writeLabels(rule.Labels)
	writeString(rule.Condition)
	writeQuery()

	if rule.IsPaused {
		writeInt(1)
	} else {
		writeInt(0)
	}

	for _, setting := range rule.NotificationSettings {
		binary.LittleEndian.PutUint64(tmp, uint64(setting.Fingerprint()))
		writeBytes(tmp)
	}

	// fields that do not affect the state.
	// TODO consider removing fields below from the fingerprint
	writeInt(int64(rule.For))
	if rule.DashboardUID != nil {
		writeString(*rule.DashboardUID)
	}
	if rule.PanelID != nil {
		writeInt(*rule.PanelID)
	}
	writeString(rule.RuleGroup)
	writeInt(int64(rule.RuleGroupIndex))
	writeString(string(rule.NoDataState))
	writeString(string(rule.ExecErrState))
	if rule.Record != nil {
		binary.LittleEndian.PutUint64(tmp, uint64(rule.Record.Fingerprint()))
		writeBytes(tmp)
	}

	return fingerprint(sum.Sum64())
}
