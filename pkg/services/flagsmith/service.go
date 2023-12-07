package flagsmith

import (
	flagsmithClient "github.com/Flagsmith/flagsmith-go-client/v3"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	flagsmith "github.com/open-feature/go-sdk-contrib/providers/flagsmith/pkg"
	of "github.com/open-feature/go-sdk/pkg/openfeature"
)

func ProvideFlagsmithOfClient(cfg *setting.Cfg, licensing licensing.Licensing) (*FlagsmithOfClient, error) {
	// Initialize the flagsmith client
	client := flagsmithClient.NewClient("KtrCQcc8524JJcZK3xuaT2")

	// Initialize the flagsmith provider
	provider := flagsmith.NewProvider(client, flagsmith.WithUsingBooleanConfigValue())

	of.SetProvider(provider)

	evalCtx := of.NewEvaluationContext(cfg.AppURL, map[string]interface{}{})

	// Create open feature client
	ofClient := of.NewClient("grafana-backend")

	foc := &FlagsmithOfClient{evalCtx, ofClient}

	return foc, nil
}
