package authenticator

import (
	"net/http"
	"strconv"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/appcontext"
)

var _ authenticator.RequestFunc = signedInUserAuthenticator

func signedInUserAuthenticator(req *http.Request) (*authenticator.Response, bool, error) {
	ctx := req.Context()
	signedInUser, err := appcontext.User(ctx)
	if err != nil {
		klog.V(5).Info("failed to get signed in user", "err", err)
		return nil, false, nil
	}

	userInfo := &user.DefaultInfo{
		Name:   signedInUser.Login,
		UID:    signedInUser.UserUID,
		Groups: []string{},
		// In order to faithfully round-trip through an impersonation flow, Extra keys MUST be lowercase.
		// see: https://pkg.go.dev/k8s.io/apiserver@v0.27.1/pkg/authentication/user#Info
		Extra: map[string][]string{},
	}

	for _, v := range signedInUser.Teams {
		userInfo.Groups = append(userInfo.Groups, strconv.FormatInt(v, 10))
	}

	// Mark Anonymous users more clearly
	if signedInUser.NamespacedID.Namespace() == identity.NamespaceAnonymous {
		// See: https://github.com/kubernetes/kubernetes/blob/v1.30.2/staging/src/k8s.io/apiserver/pkg/authentication/request/anonymous/anonymous.go#L36
		userInfo.Name = user.Anonymous
		userInfo.Groups = append(userInfo.Groups, user.AllUnauthenticated)
	}

	//
	if signedInUser.IDToken != "" {
		userInfo.Extra["id-token"] = []string{signedInUser.IDToken}
	}
	if signedInUser.OrgRole.IsValid() {
		userInfo.Extra["user-instance-role"] = []string{string(signedInUser.OrgRole)}
	}

	auds, _ := authenticator.AudiencesFrom(ctx)
	return &authenticator.Response{
		User:      userInfo,
		Audiences: auds,
	}, true, nil
}
