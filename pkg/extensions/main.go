package extensions

import (
	// Upgrade ldapsync from cron to cron.v3 and
	// remove the cron (v1) dependency

	_ "github.com/Azure/azure-sdk-for-go/services/keyvault/v7.1/keyvault"
	_ "github.com/Azure/go-autorest/autorest"
	_ "github.com/beevik/etree"
	_ "github.com/cortexproject/cortex/pkg/util"
	_ "github.com/crewjam/saml"
	_ "github.com/gobwas/glob"
	_ "github.com/grafana/loki/clients/pkg/promtail/client"
	_ "github.com/grafana/loki/pkg/logproto"
	_ "github.com/grpc-ecosystem/go-grpc-middleware"
	_ "github.com/jung-kurt/gofpdf"
	_ "github.com/linkedin/goavro/v2"
	_ "github.com/m3db/prometheus_remote_client_golang/promremote"
	_ "github.com/pkg/errors"
	_ "github.com/robfig/cron"
	_ "github.com/robfig/cron/v3"
	_ "github.com/russellhaering/goxmldsig"
	_ "github.com/stretchr/testify/require"
	_ "github.com/timberio/go-datemath"
	_ "golang.org/x/time/rate"
	_ "gopkg.in/square/go-jose.v2"
)

var IsEnterprise bool = false
