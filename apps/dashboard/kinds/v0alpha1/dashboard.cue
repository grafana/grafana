package v0alpha1

import (
	"github.com/grafana/grafana/sdkkinds/dashboard/common"
)

Dashboard: {
	schema: {
		spec:   Spec
		status: common.DashboardStatus
	}
}

// TODO: this outputs nothing.
// For now, we use unstructured for the spec,
// but it cannot be produced by the SDK codegen.
Spec: [string]: _
