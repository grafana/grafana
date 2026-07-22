module github.com/grafana/grafana/pkg/codegen

go 1.26.5

require (
	cuelang.org/go v0.11.1
	github.com/dave/dst v0.27.4
	github.com/grafana/codejen v0.0.4
	github.com/grafana/cog v0.1.15
	github.com/grafana/cuetsy v0.1.11
	github.com/matryer/is v1.4.1
	golang.org/x/tools v0.47.0
)

require (
	github.com/cockroachdb/apd/v2 v2.0.2 // indirect
	github.com/dave/jennifer v1.7.1 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/dlclark/regexp2 v1.11.5 // indirect
	github.com/emicklei/proto v1.14.2 // indirect
	github.com/fatih/color v1.19.0 // indirect
	github.com/getkin/kin-openapi v0.140.0 // indirect
	github.com/go-openapi/jsonpointer v0.23.1 // indirect
	github.com/go-openapi/swag/jsonname v0.26.1 // indirect
	github.com/goccy/go-yaml v1.19.2 // indirect
	github.com/golang/glog v1.2.5 // indirect
	github.com/google/go-cmp v0.7.0 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/huandu/xstrings v1.5.0 // indirect
	github.com/kr/pretty v0.3.1 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/lib/pq v1.12.3 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.22 // indirect
	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
	github.com/mpvl/unique v0.0.0-20150818121801-cbe035fff7de // indirect
	github.com/oasdiff/yaml v0.1.0 // indirect
	github.com/oasdiff/yaml3 v0.0.13 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/protocolbuffers/txtpbfmt v0.0.0-20251124094003-fcb97cc64c7b // indirect
	github.com/rogpeppe/go-internal v1.14.1 // indirect
	github.com/santhosh-tekuri/jsonschema/v6 v6.0.2 // indirect
	github.com/sergi/go-diff v1.3.2-0.20230802210424-5b0b94c5c0d3 // indirect
	github.com/xlab/treeprint v1.2.0 // indirect
	github.com/yalue/merged_fs v1.3.0 // indirect
	golang.org/x/mod v0.37.0 // indirect
	golang.org/x/net v0.57.0 // indirect
	golang.org/x/sync v0.22.0 // indirect
	golang.org/x/sys v0.47.0 // indirect
	golang.org/x/text v0.40.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace cuelang.org/go => github.com/grafana/cue v0.0.0-20230926092038-971951014e3f // @grafana/grafana-as-code

replace github.com/protocolbuffers/txtpbfmt => github.com/protocolbuffers/txtpbfmt v0.0.0-20220428173112-74888fd59c2b
