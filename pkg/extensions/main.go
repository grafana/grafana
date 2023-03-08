package extensions

import (
	_ "cloud.google.com/go/kms/apiv1"
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
	_ "github.com/grafana/dskit/backoff"
	_ "github.com/grafana/dskit/flagext"
	_ "github.com/grpc-ecosystem/go-grpc-middleware"
	_ "github.com/jung-kurt/gofpdf"
	_ "github.com/linkedin/goavro/v2"
	_ "github.com/m3db/prometheus_remote_client_golang/promremote"
	_ "github.com/robfig/cron/v3"
	_ "github.com/russellhaering/goxmldsig"
	_ "github.com/stretchr/testify/require"
	_ "github.com/vectordotdev/go-datemath"
	_ "golang.org/x/time/rate"
	_ "google.golang.org/genproto/googleapis/cloud/kms/v1"
)

var IsEnterprise bool = false
