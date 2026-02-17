# Grafana OpenFeature Infrastructure

This module allows external services and plugins to:
- Connect to MTFF with token exchange authentication
- Use other OFREP (OpenFeature Remote Evaluation Protocol) providers
- Create authenticated HTTP clients with token exchange middleware

## Provider Types

Two remote provider types are supported:

- **`OFREPProviderType`** - Remote provider using OFREP protocol
- **`FeaturesServiceProviderType`** - Grafana's features service with token exchange authentication

For local development or testing, use OpenFeature's standard `memprovider.InMemoryProvider` instead of this package.

## Usage Examples

### Unauthenticated OFREP Provider

For public/unauthenticated OFREP endpoints:

```go
package main

import (
    "context"
    "net/url"
    "time"

    "github.com/grafana/grafana/pkg/infra/features"
    "github.com/open-feature/go-sdk/openfeature"
)

func main() {
    // Create a plain HTTP client (no authentication)
    httpClient, err := features.CreateHTTPClient(
        features.HTTPClientOptions{
            Timeout:            10 * time.Second,
            InsecureSkipVerify: false,
        },
    )
    if err != nil {
        panic(err)
    }

    // Initialize OpenFeature with unauthenticated OFREP provider
    providerURL, _ := url.Parse("https://public-ofrep-server.example.com")

    config := features.OpenFeatureConfig{
        ProviderType: features.OFREPProviderType,
        URL:          providerURL,
        HTTPClient:   httpClient,
        TargetingKey: "my-app-instance",
    }

    if err := features.InitOpenFeature(config); err != nil {
        panic(err)
    }

    // Use OpenFeature client
    client := openfeature.NewClient("my-service")
    enabled, _ := client.BooleanValue(
        context.Background(),
        "myFeatureFlag",
        false,
        openfeature.EvaluationContext{},
    )

    println("Feature enabled:", enabled)
}
```

### Authenticated Provider with Token Exchange

For Grafana's features service or authenticated OFREP endpoints that require token exchange:

```go
package main

import (
    "context"
    "net/url"
    "time"

    authlib "github.com/grafana/authlib/authn"
    "github.com/grafana/grafana/pkg/infra/features"
    "github.com/open-feature/go-sdk/openfeature"
)

func main() {
    // Create a token exchange client
    // In a real app, get these from your configuration
    tokenExchangeClient, err := authlib.NewTokenExchangeClient(authlib.TokenExchangeConfig{
        Token:            "your-service-token",
        TokenExchangeURL: "https://token-exchange.grafana.com/oauth2/token",
    })
    if err != nil {
        panic(err)
    }

    // Create authenticated HTTP client with token exchange (simplified single call)
    httpClient, err := features.CreateHTTPClientWithTokenExchange(
        tokenExchangeClient,
        "stack-123", // Your namespace/stack ID. Use "*" for multi-tenant services.
        []string{features.FeaturesProviderAudience},
        features.HTTPClientOptions{
            Timeout:            10 * time.Second,
            InsecureSkipVerify: false, // Use true only in development
        },
    )
    if err != nil {
        panic(err)
    }

    // Initialize OpenFeature with authenticated provider
    providerURL, _ := url.Parse("https://features-service.grafana.com")

    config := features.OpenFeatureConfig{
        ProviderType: features.FeaturesServiceProviderType,
        URL:          providerURL,
        HTTPClient:   httpClient,
        TargetingKey: "my-app-instance",
        ContextAttrs: map[string]any{
            "environment": "production",
            "region":      "us-east-1",
        },
    }

    if err := features.InitOpenFeature(config); err != nil {
        panic(err)
    }

    // Use OpenFeature client
    client := openfeature.NewClient("my-service")
    enabled, _ := client.BooleanValue(
        context.Background(),
        "myFeatureFlag",
        false,
        openfeature.EvaluationContext{},
    )

    println("Feature enabled:", enabled)
}
```
