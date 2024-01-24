package folderimpl

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/services/supportbundles"
)

func (fs *Service) registerSupportBundleCollectors(bundleRegistry supportbundles.Service) {
	for name, connector := range fs.socialMap {
		bundleRegistry.RegisterSupportItemCollector(supportbundles.Collector{
			UID:               "oauth-" + name,
			DisplayName:       "OAuth " + strings.Title(strings.ReplaceAll(name, "_", " ")),
			Description:       "OAuth configuration and healthchecks for " + name,
			IncludedByDefault: false,
			Default:           false,
			EnabledFn:         func() bool { return connector.GetOAuthInfo().Enabled },
			Fn:                fs.supportBundleCollectorFn(),
		})
	}
}

func (fs *Service) supportBundleCollectorFn() func(context.Context) (*supportbundles.SupportItem, error) {
	return func(ctx context.Context) (*supportbundles.SupportItem, error) {

		return &supportbundles.SupportItem{
			Filename:  "folder.json ",
			FileBytes: []byte("hello world"),
		}, nil
	}
}
