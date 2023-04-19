package publicdashboard

import (
	"github.com/google/wire"
	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
)

var WireSet = wire.NewSet(
	ProvideValidation,
	wire.Bind(new(admission.ValidatingAdmissionController), new(*pdValidation)),
	ProvideMutation,
	wire.Bind(new(admission.MutatingAdmissionController), new(*pdMutation)),
	ProvideWatcher,
	ProvideService,
	wire.Bind(new(publicdashboards.Service), new(*ServiceWrapper)),
)
