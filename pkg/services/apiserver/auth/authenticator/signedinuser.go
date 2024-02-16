package authenticator

import (
	"net/http"
	"strconv"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/klog/v2"

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

	userInfo := &k8suser.DefaultInfo{
		Name:   signedInUser.Login,
		UID:    signedInUser.UserUID,
		Groups: []string{},
		Extra:  map[string][]string{},
	}

	for _, v := range signedInUser.Teams {
		userInfo.Groups = append(userInfo.Groups, strconv.FormatInt(v, 10))
	}

	if signedInUser.IDToken != "" {
		userInfo.Extra["ID-Token"] = []string{signedInUser.IDToken}
	}

	return &authenticator.Response{
		User: userInfo,
	}, true, nil
}
