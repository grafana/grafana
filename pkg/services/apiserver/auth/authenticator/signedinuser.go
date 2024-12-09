package authenticator

import (
	"net/http"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/klog/v2"
)

var _ authenticator.RequestFunc = signedInUserAuthenticator

func signedInUserAuthenticator(req *http.Request) (*authenticator.Response, bool, error) {
	ctx := req.Context()
	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		klog.V(5).Info("failed to get signed in user", "err", err)
		return nil, false, nil
	}

	return &authenticator.Response{
		User: signedInUser,
	}, true, nil
}
