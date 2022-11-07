package fakes

import "github.com/grafana/grafana/pkg/services/featuremgmt"

type FakeFeatures struct {
	BigTransactions bool
}

func (f *FakeFeatures) IsEnabled(feature string) bool {
	if feature == featuremgmt.FlagAlertingBigTransactions {
		return f.BigTransactions
	}

	return false
}
