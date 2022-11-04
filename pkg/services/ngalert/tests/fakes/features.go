package fakes

import "github.com/grafana/grafana/pkg/services/featuremgmt"

type FakeFeatures struct {
	BigTransactions bool
	NoNormalState   bool
}

func (f *FakeFeatures) IsEnabled(feature string) bool {
	switch feature {
	case featuremgmt.FlagAlertingBigTransactions:
		return f.BigTransactions
	case featuremgmt.FlagAlertingNoNormalState:
		return f.NoNormalState
	}
	return false
}
