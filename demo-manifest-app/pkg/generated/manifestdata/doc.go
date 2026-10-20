// Package manifestdata is a stub that exists purely so `go mod tidy` resolves its dependencies before
// code generation has run. `generate:kinds` fills this package with its own generated files, without
// removing this one — it's left behind, harmless, since it exports nothing.
package manifestdata

import (
	_ "github.com/grafana/grafana-app-sdk/app"
	_ "github.com/grafana/grafana-app-sdk/resource"
	_ "k8s.io/apimachinery/pkg/runtime"
	_ "k8s.io/kube-openapi/pkg/spec3"
	_ "k8s.io/kube-openapi/pkg/validation/spec"
)
