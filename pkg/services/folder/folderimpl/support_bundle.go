package folderimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/supportbundles"
)

func (s *Service) supportBundleCollector() supportbundles.Collector {
	return supportbundles.Collector{
		UID:               "folder",
		DisplayName:       "Nested folder statistics",
		Description:       "Nested folder statistics of the Grafana instance",
		IncludedByDefault: false,
		Default:           false,
		Fn: func(ctx context.Context) (*supportbundles.SupportItem, error) {
			return &supportbundles.SupportItem{
				Filename:  "folder-stats.json",
				FileBytes: []byte("hello world"),
			}, nil
		},
	}
}

// func (s *Service) supportBundleCollectorFn() func(context.Context) (*supportbundles.SupportItem, error) {
// 	return func(ctx context.Context) (*supportbundles.SupportItem, error) {

// 		return &supportbundles.SupportItem{
// 			Filename:  "folder-stats.json",
// 			FileBytes: []byte("hello world"),
// 		}, nil
// 	}
// }
