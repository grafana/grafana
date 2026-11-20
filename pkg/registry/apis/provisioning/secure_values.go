package provisioning

import (
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// inProcessSecureValues is the client secure values are addressed through when this process
// serves them itself, nil when nothing registered one.
var inProcessSecureValues resources.InProcessClient

// ServeSecureValuesInProcess hands provisioning the in-process secrets client, which is what lets
// a local repository provision secure values where the secrets API is not served.
//
// HACK: a package-level setter rather than a RegisterAPIService parameter, because other editions
// build against that signature and one that serves the API has nothing to inject. The wiring that
// holds the client runs before the API builder exists, and it is a dependency of the repository
// factory RegisterAPIService takes, so the call always lands first.
func ServeSecureValuesInProcess(client resources.InProcessClient) {
	inProcessSecureValues = client
}

// serveSecureValues points the declared secrets kind at the registered client. A kind the
// configuration left out is not served, registered client or not.
func serveSecureValues(supported []resources.SupportedResource) {
	if inProcessSecureValues == nil {
		return
	}

	resources.ServeInProcess(supported,
		secretv1beta1.SecureValuesResourceInfo.GroupVersionKind(),
		secretv1beta1.SecureValuesResourceInfo.GroupVersionResource(),
		inProcessSecureValues)
}
