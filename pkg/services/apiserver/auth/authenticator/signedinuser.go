package authenticator

import (
	"net/http"
	"strconv"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

var _ authenticator.RequestFunc = signedInUserAuthenticator

func signedInUserAuthenticator(req *http.Request) (*authenticator.Response, bool, error) {
	ctx := req.Context()
	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		klog.V(5).Info("failed to get signed in user", "err", err)
		return nil, false, nil
	}

	userInfo := &k8suser.DefaultInfo{
		Name:   signedInUser.GetLogin(),
		UID:    signedInUser.GetUID().ID(),
		Groups: []string{},
		// In order to faithfully round-trip through an impersonation flow, Extra keys MUST be lowercase.
		// see: https://pkg.go.dev/k8s.io/apiserver@v0.27.1/pkg/authentication/user#Info
		Extra: map[string][]string{},
	}

	for _, v := range signedInUser.GetTeams() {
		userInfo.Groups = append(userInfo.Groups, strconv.FormatInt(v, 10))
	}

	//
	if signedInUser.GetIDToken() != "" {
		userInfo.Extra["id-token"] = []string{signedInUser.GetIDToken()}
	}
	if signedInUser.GetOrgRole().IsValid() {
		userInfo.Extra["user-instance-role"] = []string{string(signedInUser.GetOrgRole())}
	}

	return &authenticator.Response{
		User: userInfo,
	}, true, nil
}
