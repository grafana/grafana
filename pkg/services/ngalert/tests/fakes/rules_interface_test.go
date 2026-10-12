package fakes

import (
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
)

// RuleStore stands in for the real rule store, so it has to keep satisfying the store's own
// interfaces. Without this the fake drifts: it accumulates methods no interface declares any more,
// and a method added to a segment is only caught in whichever test happens to pass the fake.
//
// These are the segments the fake implements; the rest of rulestore.Store (scheduling,
// notification-settings renames, the folder registry and trash maintenance) is faked elsewhere by
// the packages that need it. The assertions live in a test file because the fake is only used from
// tests, and because api and provisioning cannot be imported here — notifier/testing.go imports
// this package, so naming their unions would close an import cycle.
var (
	_ rulestore.NamespaceStore          = (*RuleStore)(nil)
	_ rulestore.RuleReader              = (*RuleStore)(nil)
	_ rulestore.RulePageReader          = (*RuleStore)(nil)
	_ rulestore.RuleByIDReader          = (*RuleStore)(nil)
	_ rulestore.RuleGroupReader         = (*RuleStore)(nil)
	_ rulestore.RuleCounter             = (*RuleStore)(nil)
	_ rulestore.RuleWriter              = (*RuleStore)(nil)
	_ rulestore.RuleAdminWriter         = (*RuleStore)(nil)
	_ rulestore.RuleVersionReader       = (*RuleStore)(nil)
	_ rulestore.RuleVersionFolderReader = (*RuleStore)(nil)
	_ rulestore.StatusWriter            = (*RuleStore)(nil)
)
