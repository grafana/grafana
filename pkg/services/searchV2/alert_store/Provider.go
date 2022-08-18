package alert_store

import (
	ngstore "github.com/grafana/grafana/pkg/services/ngalert/store"
)

// workaround for cyclic dep

type Provider struct{}

var RuleStore ngstore.RuleStore

func ProvideService(
	store ngstore.RuleStore,
) *Provider {
	RuleStore = store
	return &Provider{}
}
