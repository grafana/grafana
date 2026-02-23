package interceptors

import "context"

// ServiceWithAuth wraps a service implementation and adds per-service
// authentication via the grpc_auth.ServiceAuthFuncOverride interface.
type ServiceWithAuth struct {
	authenticator Authenticator
}

// AuthFuncOverride implements the grpc_auth.ServiceAuthFuncOverride
// interface to override the global AuthFunc.
func (w *ServiceWithAuth) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	return w.authenticator.Authenticate(ctx)
}

// NewServiceAuth returns a *ServiceWithAuth that can used to add per-service authentication.
func NewServiceAuth(authenticator Authenticator) *ServiceWithAuth {
	if authenticator == nil {
		return nil
	}
	return &ServiceWithAuth{authenticator: authenticator}
}
