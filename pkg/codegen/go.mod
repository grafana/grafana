module github.com/grafana/grafana/pkg/codegen

go 1.24.5

require (
	cuelang.org/go v0.11.1
	github.com/dave/dst v0.27.3
	github.com/getkin/kin-openapi v0.132.0
	github.com/grafana/codejen v0.0.4-0.20230321061741-77f656893a3d
	github.com/grafana/cuetsy v0.1.11
	github.com/matryer/is v1.4.1
	github.com/oapi-codegen/oapi-codegen/v2 v2.4.1
	golang.org/x/tools v0.33.0
)

require (
	github.com/cockroachdb/apd/v2 v2.0.2 // indirect
	github.com/dave/jennifer v1.6.0 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/dprotaso/go-yit v0.0.0-20220510233725-9ba8df137936 // indirect
	github.com/emicklei/proto v1.13.2 // indirect
	github.com/fsnotify/fsnotify v1.8.0 // indirect
	github.com/go-openapi/jsonpointer v0.21.0 // indirect
	github.com/go-openapi/swag v0.23.0 // indirect
	github.com/golang/glog v1.2.4 // indirect
	github.com/google/go-cmp v0.7.0 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-multierror v1.1.1 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/lib/pq v1.10.9 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mohae/deepcopy v0.0.0-20170929034955-c48cc78d4826 // indirect
	github.com/mpvl/unique v0.0.0-20150818121801-cbe035fff7de // indirect
	github.com/oasdiff/yaml v0.0.0-20250309154309-f31be36b4037 // indirect
	github.com/oasdiff/yaml3 v0.0.0-20250309153720-d2182401db90 // indirect
	github.com/onsi/ginkgo v1.16.5 // indirect
	github.com/onsi/gomega v1.36.1 // indirect
	github.com/perimeterx/marshmallow v1.1.5 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/protocolbuffers/txtpbfmt v0.0.0-20241112170944-20d2c9ebc01d // indirect
	github.com/rogpeppe/go-internal v1.14.1 // indirect
	github.com/sergi/go-diff v1.3.2-0.20230802210424-5b0b94c5c0d3 // indirect
	github.com/speakeasy-api/openapi-overlay v0.9.0 // indirect
	github.com/stretchr/testify v1.10.0 // indirect
	github.com/vmware-labs/yaml-jsonpath v0.3.2 // indirect
	github.com/xlab/treeprint v1.2.0 // indirect
	golang.org/x/mod v0.24.0 // indirect
	golang.org/x/net v0.40.0 // indirect
	golang.org/x/sync v0.14.0 // indirect
	golang.org/x/text v0.25.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace cuelang.org/go => github.com/grafana/cue v0.0.0-20230926092038-971951014e3f // @grafana/grafana-as-code

replace github.com/protocolbuffers/txtpbfmt => github.com/protocolbuffers/txtpbfmt v0.0.0-20220428173112-74888fd59c2b
