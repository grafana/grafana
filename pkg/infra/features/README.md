# For connecting to Multi-tenant Feature Flag service:

```go
package main

import (
  "context"
  "fmt"
  "net/url"
  "time"

  authlib "github.com/grafana/authlib/authn"
  "github.com/grafana/grafana/pkg/infra/features"
  "github.com/open-feature/go-sdk/openfeature"
)

func SomeFunc(ctx context.Context) error {
  // Create a token exchange client
  // In a real app, get these from your configuration
  tokenExchangeClient, err := authlib.NewTokenExchangeClient(authlib.TokenExchangeConfig{
    Token:            "your-service-token",
    TokenExchangeURL: "https://token-exchange-url",
  })
  if err != nil {
    return err
  }

  // Create authentication config
  // The namespace controls the identity scope for token exchange (not feature evaluation)
  authConfig := features.TokenExchangeConfig{
    TokenExchanger: tokenExchangeClient,
    Namespace:      "stack-123", // Use "*" for multi-tenant services
    Audiences:      []string{features.FeaturesProviderAudience},
  }

  // Create authenticated HTTP client
  httpClient, err := features.CreateAuthenticatedHTTPClient(
    authConfig,
    features.HTTPClientOptions{
      Timeout: 10 * time.Second,
    },
  )
  if err != nil {
    return err
  }

  // Initialize OpenFeature with authenticated provider
  providerURL, err := url.Parse("https://features-service-url")
  if err != nil {
    return fmt.Errorf("failed to parse provider URL: %w", err)
  }

  config := features.OpenFeatureConfig{
    ProviderType: features.FeaturesServiceProviderType,
    URL:          providerURL,
    HTTPClient:   httpClient,
    TargetingKey: "stacks-123",
    ContextAttrs: map[string]any{
      "cluster": "cluster-1",
      "region":  "us-east-1",
    },
  }

  if err := features.InitOpenFeature(config); err != nil {
    return err
  }

  // Use OpenFeature client
  client := openfeature.NewDefaultClient()
  enabled, err := client.BooleanValue(
    context.Background(),
    "myFeatureFlag",
    false,
    openfeature.TransactionContext(ctx),
  )

  fmt.Println("Feature enabled:", enabled)
  return err
}
```
