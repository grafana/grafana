package authenticator

import (
	"net/http"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/union"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func NewAuthenticator(authRequestHandlers ...authenticator.Request) authenticator.Request {
	handlers := append([]authenticator.Request{authenticator.RequestFunc(identityAuthenticator)}, authRequestHandlers...)
	return union.New(handlers...)
}

var _ authenticator.RequestFunc = identityAuthenticator

// identityAuthenticator check if we have any identity set in context.
// If not we delegate authentication to next authenticator in the chain.
func identityAuthenticator(req *http.Request) (*authenticator.Response, bool, error) {
	ident, err := identity.GetRequester(req.Context())
	if err != nil {
		klog.V(5).Info("no idenitty in context", "err", err)
		return nil, false, nil
	}

	return &authenticator.Response{User: ident}, true, nil
}
