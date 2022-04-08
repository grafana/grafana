package main

import (
	"context"
	"os"

	"github.com/davecgh/go-spew/spew"
	go_client "github.com/grafana/grafana/pkg/api/docs/clients/go"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/models"
)

func main() {
	cfg := go_client.NewConfiguration()
	cfg.BasePath = "http://localhost:3000/api"
	client := go_client.NewAPIClient(cfg)
	// Get API keys: with basic auth
	basicAuth := context.WithValue(context.Background(), go_client.ContextBasicAuth, go_client.BasicAuth{
		UserName: "admin",
		Password: "password",
	})
	keys, _, err := client.ApiKeysApi.GetAPIkeys(basicAuth, &go_client.ApiKeysApiGetAPIkeysOpts{IncludeExpired: true})
	if err != nil {
		logger.Error(err)
	}
	existingKeys := len(keys)
	// Create key
	dto, _, err := client.ApiKeysApi.AddAPIkey(basicAuth, models.AddApiKeyCommand{
		Name:          "just-testing unique",
		Role:          "Admin",
		SecondsToLive: 10,
	})
	if err != nil {
		logger.Error(err)
	}
	// Get API keys: with the newly created API key
	APIKeyAuth := context.WithValue(context.Background(), go_client.ContextAPIKey, go_client.APIKey{
		Key:    dto.Key,
		Prefix: "Bearer", // Omit if not necessary.
	})
	keys, _, err = client.ApiKeysApi.GetAPIkeys(APIKeyAuth, &go_client.ApiKeysApiGetAPIkeysOpts{IncludeExpired: true})
	if err != nil {
		logger.Error(err)
	}
	if len(keys) != existingKeys+1 {
		os.Exit(-1)
	}
	spew.Dump(">>>>", keys)
}
