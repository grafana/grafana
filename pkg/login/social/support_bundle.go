package social

import (
	"bytes"
	"context"

	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/services/supportbundles/bundleregistry"
)

func (ss *SocialService) registerSupportBundleCollectors(bundleRegistry ) {

}

func (ss *SocialService) supportBundleCollector(context.Context) (*supportbundles.SupportItem, error) {
	bWriter := bytes.NewBuffer(nil)

	bWriter.WriteString("# OAuth information\n\n")

	for _, p := range ss.oauthProviders {




	return &supportbundles.SupportItem{
		Filename:  "oauth.md",
		FileBytes: bWriter.Bytes(),
	}, nil
}
