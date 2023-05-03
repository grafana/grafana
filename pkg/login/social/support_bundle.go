package social

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/BurntSushi/toml"

	"github.com/grafana/grafana/pkg/services/supportbundles"
)

func (ss *SocialService) registerSupportBundleCollectors(bundleRegistry supportbundles.Service) {
	for name := range ss.oAuthProvider {
		bundleRegistry.RegisterSupportItemCollector(supportbundles.Collector{
			UID:               "oauth-" + name,
			DisplayName:       "OAuth " + strings.Title(strings.ReplaceAll(name, "_", " ")),
			Description:       "OAuth configuration and healthchecks for " + name,
			IncludedByDefault: false,
			Default:           false,
			Fn:                ss.supportBundleCollectorFn(name, ss.socialMap[name], ss.oAuthProvider[name]),
		})
	}
}

func (ss *SocialService) supportBundleCollectorFn(name string, sc SocialConnector, oinfo *OAuthInfo) func(context.Context) (*supportbundles.SupportItem, error) {
	return func(ctx context.Context) (*supportbundles.SupportItem, error) {
		bWriter := bytes.NewBuffer(nil)

		if _, err := bWriter.WriteString(fmt.Sprintf("# OAuth %s information\n\n", name)); err != nil {
			return nil, err
		}

		if _, err := bWriter.WriteString("## Parsed Configuration\n\n"); err != nil {
			return nil, err
		}

		bWriter.WriteString("```toml\n")
		errM := toml.NewEncoder(bWriter).Encode(oinfo)
		if errM != nil {
			bWriter.WriteString(
				fmt.Sprintf("Unable to encode OAuth configuration  \n Err: %s", errM))
		}
		bWriter.WriteString("```\n\n")

		if err := sc.SupportBundleContent(bWriter); err != nil {
			return nil, err
		}

		ss.healthCheckSocialConnector(ctx, name, oinfo, bWriter)

		return &supportbundles.SupportItem{
			Filename:  "oauth-" + name + ".md",
			FileBytes: bWriter.Bytes(),
		}, nil
	}
}

func (ss *SocialService) healthCheckSocialConnector(ctx context.Context, name string, oinfo *OAuthInfo, bWriter *bytes.Buffer) {
	bWriter.WriteString("## Health checks\n\n")
	client, err := ss.GetOAuthHttpClient(name)
	if err != nil {
		bWriter.WriteString(fmt.Sprintf("Unable to create HTTP client  \n Err: %s\n", err))
		return
	}

	healthCheckEndpoint(client, bWriter, "API", oinfo.ApiUrl)
	healthCheckEndpoint(client, bWriter, "Auth", oinfo.AuthUrl)
	healthCheckEndpoint(client, bWriter, "Token", oinfo.TokenUrl)
	healthCheckEndpoint(client, bWriter, "Teams", oinfo.TeamsUrl)
}

func healthCheckEndpoint(client *http.Client, bWriter *bytes.Buffer, endpointName string, url string) {
	if url == "" {
		return
	}

	bWriter.WriteString(fmt.Sprintf("### %s URL\n\n", endpointName))
	resp, err := client.Get(url)
	_ = resp.Body.Close()
	if err != nil {
		bWriter.WriteString(fmt.Sprintf("Unable to GET %s URL  \n Err: %s\n\n", endpointName, err))
	} else {
		bWriter.WriteString(fmt.Sprintf("Able to reach %s URL. Status Code does not need to be 200.\n Retrieved Status Code: %d \n\n", endpointName, resp.StatusCode))
	}
}
