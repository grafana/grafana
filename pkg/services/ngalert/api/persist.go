package api

import (
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
)

// RuleStore is the interface for persisting alert rules and instances.
//
// Composed from the rule store's own segments rather than restating each method, so that adding a
// method there cannot leave a stale copy here. It is still declared in this package, because what
// the API layer depends on is this package's concern.
//
// Composing whole segments means this is slightly wider than the set the API layer actually calls:
// it also pulls in GetRuleByID, ListAlertRulesPaginated, GetRuleGroupInterval, Count and
// GetAlertRuleVersionFolders. That is the trade for not duplicating twenty signatures.
type RuleStore interface {
	// TODO after deprecating namespace_id field in GettableGrafanaRule we can simplify this
	// interface by returning map[string]struct{} instead of map[string]*folder.FolderReference
	rulestore.NamespaceStore
	rulestore.RuleReader
	rulestore.RuleWriter
	rulestore.RuleVersionReader
	rulestore.StatusWriter
}
