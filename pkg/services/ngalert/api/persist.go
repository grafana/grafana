package api

import (
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
)

// RuleStore is the interface for persisting alert rules and instances.
type RuleStore interface {
	// TODO after deprecating namespace_id field in GettableGrafanaRule we can simplify this
	// interface by returning map[string]struct{} instead of map[string]*folder.FolderReference
	rulestore.NamespaceStore
	rulestore.RuleReader
	rulestore.RuleGroupReader
	rulestore.RuleWriter
	rulestore.RuleAdminWriter
	rulestore.RuleVersionReader
	rulestore.StatusWriter
}
