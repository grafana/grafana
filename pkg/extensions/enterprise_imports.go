//go:build enterprise || pro
// +build enterprise pro

package extensions

import (
	_ "cloud.google.com/go/kms/apiv1"
	_ "cloud.google.com/go/kms/apiv1/kmspb"
	_ "cloud.google.com/go/spanner"
	_ "github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	_ "github.com/Azure/azure-sdk-for-go/sdk/keyvault/azkeys"
	_ "github.com/Azure/azure-sdk-for-go/services/keyvault/v7.1/keyvault"
	_ "github.com/Azure/go-autorest/autorest"
	_ "github.com/Azure/go-autorest/autorest/adal"
	_ "github.com/beevik/etree"
	_ "github.com/blugelabs/bluge"
	_ "github.com/blugelabs/bluge_segment_api"
	_ "github.com/crewjam/saml"
	_ "github.com/go-jose/go-jose/v3"
	_ "github.com/gobwas/glob"
	_ "github.com/googleapis/gax-go/v2"
	_ "github.com/grpc-ecosystem/go-grpc-middleware/providers/prometheus"
	_ "github.com/grpc-ecosystem/go-grpc-middleware/v2"
	_ "github.com/hashicorp/go-multierror"
	_ "github.com/hashicorp/golang-lru/v2"
	_ "github.com/m3db/prometheus_remote_client_golang/promremote"
	_ "github.com/phpdave11/gofpdi"
	_ "github.com/robfig/cron/v3"
	_ "github.com/russellhaering/goxmldsig"
	_ "github.com/spf13/cobra" // used by the standalone apiserver cli
	_ "github.com/stretchr/testify/require"
	_ "golang.org/x/time/rate"
	_ "xorm.io/builder"

	_ "github.com/grafana/dskit/backoff"
	_ "github.com/grafana/dskit/flagext"
	_ "github.com/grafana/e2e"
	_ "github.com/grafana/gofpdf"
	_ "github.com/grafana/gomemcache/memcache"
)
