package search

import "context"

// RuleStatus is the runtime state and health of a rule, sourced from the
// alerting engine (the ruler), keyed by rule UID.
type RuleStatus struct {
	State  string
	Health string
}

// RuleStatusReader returns runtime state/health for rules in a namespace,
// keyed by rule UID (metadata.name). It is the seam for joining ruler data
// with the config search so the handler can serve state/health filters and
// hydrate hits without the config backends depending on the engine.
//
// TODO: not yet consumed. When state/health support lands, the handler will,
// depending on whether state/health is filtered or only displayed:
//   - display only: run config search (with its own pagination), then hydrate
//     the returned page's UIDs via this reader;
//   - filtered: join the config set with statuses on UID, apply the
//     state/health predicate, then sort and paginate the joined set.
//
// The names (UID) filter is the seam used to scope either leg. See the
// cross-source join notes in SEARCH_ENDPOINTS_PLAN.md.
type RuleStatusReader interface {
	RuleStatuses(ctx context.Context, namespace string, uids []string) (map[string]RuleStatus, error)
}
