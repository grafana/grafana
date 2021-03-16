module github.com/grafana/grafana

go 1.15

// Override xorm's outdated go-mssqldb dependency, since we can't upgrade to current xorm (due to breaking changes).
// We need a more current go-mssqldb so we get rid of a version of apache/thrift with vulnerabilities.
replace github.com/denisenkom/go-mssqldb => github.com/denisenkom/go-mssqldb v0.0.0-20200620013148-b91950f658ec

// Override k8s.io/client-go outdated dependency, which is an indirect dependency of grafana/loki.
// It's also present on grafana/loki's go.mod so we'll need till it gets updated.
replace k8s.io/client-go => k8s.io/client-go v0.18.8

require (
	cloud.google.com/go/storage v1.14.0
	github.com/BurntSushi/toml v0.3.1
	github.com/VividCortex/mysqlerr v0.0.0-20170204212430-6c6b55f8796f
	github.com/aws/aws-sdk-go v1.37.31
	github.com/beevik/etree v1.1.0
	github.com/benbjohnson/clock v0.0.0-20161215174838-7dc76406b6d3
	github.com/bradfitz/gomemcache v0.0.0-20190913173617-a41fca850d0b
	github.com/centrifugal/centrifuge v0.15.0
	github.com/cortexproject/cortex v1.4.1-0.20201022071705-85942c5703cf
	github.com/crewjam/saml v0.4.6-0.20201227203850-bca570abb2ce
	github.com/davecgh/go-spew v1.1.1
	github.com/denisenkom/go-mssqldb v0.0.0-20200910202707-1e08a3fab204
	github.com/facebookgo/inject v0.0.0-20180706035515-f23751cae28b
	github.com/fatih/color v1.10.0
	github.com/gchaincl/sqlhooks v1.3.0
	github.com/getsentry/sentry-go v0.10.0
	github.com/go-kit/kit v0.10.0
	github.com/go-macaron/binding v0.0.0-20190806013118-0b4f37bab25b
	github.com/go-macaron/gzip v0.0.0-20160222043647-cad1c6580a07
	github.com/go-sourcemap/sourcemap v2.1.3+incompatible
	github.com/go-sql-driver/mysql v1.5.0
	github.com/go-stack/stack v1.8.0
	github.com/gobwas/glob v0.2.3
	github.com/golang/mock v1.5.0
	github.com/golang/protobuf v1.4.3
	github.com/google/go-cmp v0.5.5
	github.com/google/uuid v1.2.0
	github.com/gosimple/slug v1.9.0
	github.com/grafana/alerting-api v0.0.0-20210311171115-b0eb4577f38c
	github.com/grafana/grafana-aws-sdk v0.2.0
	github.com/grafana/grafana-plugin-model v0.0.0-20190930120109-1fc953a61fb4
	github.com/grafana/grafana-plugin-sdk-go v0.88.0
	github.com/grafana/loki v1.6.2-0.20201026154740-6978ee5d7387
	github.com/grpc-ecosystem/go-grpc-middleware v1.2.2
	github.com/hashicorp/go-hclog v0.15.0
	github.com/hashicorp/go-plugin v1.4.0
	github.com/hashicorp/go-version v1.2.1
	github.com/inconshreveable/log15 v0.0.0-20180818164646-67afb5ed74ec
	github.com/influxdata/influxdb-client-go/v2 v2.2.2
	github.com/jaegertracing/jaeger v1.22.0
	github.com/jmespath/go-jmespath v0.4.0
	github.com/json-iterator/go v1.1.10
	github.com/jung-kurt/gofpdf v1.16.2
	github.com/lib/pq v1.10.0
	github.com/linkedin/goavro/v2 v2.10.0
	github.com/magefile/mage v1.11.0
	github.com/mattn/go-isatty v0.0.12
	github.com/mattn/go-sqlite3 v1.14.6
	github.com/opentracing/opentracing-go v1.2.0
	github.com/patrickmn/go-cache v2.1.0+incompatible
	github.com/pkg/errors v0.9.1
	github.com/prometheus/alertmanager v0.21.1-0.20210315141118-bf9c43b57df6
	github.com/prometheus/client_golang v1.9.0
	github.com/prometheus/client_model v0.2.0
	github.com/prometheus/common v0.18.1-0.20210305175002-2a23014b3b39
	github.com/robfig/cron v0.0.0-20180505203441-b41be1df6967
	github.com/robfig/cron/v3 v3.0.1
	github.com/russellhaering/goxmldsig v1.1.0
	github.com/smartystreets/goconvey v1.6.4
	github.com/stretchr/testify v1.7.0
	github.com/teris-io/shortid v0.0.0-20171029131806-771a37caa5cf
	github.com/timberio/go-datemath v0.1.1-0.20200323150745-74ddef604fff
	github.com/ua-parser/uap-go v0.0.0-20190826212731-daf92ba38329
	github.com/uber/jaeger-client-go v2.25.0+incompatible
	github.com/unknwon/com v1.0.1
	github.com/urfave/cli/v2 v2.3.0
	github.com/weaveworks/common v0.0.0-20201119133501-0619918236ec
	github.com/xorcare/pointer v1.1.0
	github.com/yudai/gojsondiff v1.0.0
	go.opentelemetry.io/collector v0.22.0
	golang.org/x/crypto v0.0.0-20201221181555-eec23a3978ad
	golang.org/x/net v0.0.0-20210226172049-e18ecbb05110
	golang.org/x/oauth2 v0.0.0-20210220000619-9bb904979d93
	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c
	golang.org/x/time v0.0.0-20201208040808-7e3f01d25324
	gonum.org/v1/gonum v0.8.2
	google.golang.org/api v0.41.0
	google.golang.org/grpc v1.36.0
	gopkg.in/ini.v1 v1.62.0
	gopkg.in/ldap.v3 v3.0.2
	gopkg.in/macaron.v1 v1.4.0
	gopkg.in/mail.v2 v2.3.1
	gopkg.in/redis.v5 v5.2.9
	gopkg.in/square/go-jose.v2 v2.5.1
	gopkg.in/yaml.v2 v2.4.0
	xorm.io/core v0.7.3
	xorm.io/xorm v0.8.2
)
