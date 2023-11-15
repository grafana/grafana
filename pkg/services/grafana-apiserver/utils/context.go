package utils

import (
	"context"
	"fmt"
	"strconv"

	"google.golang.org/grpc/metadata"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	grafanaUser "github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

func ContextWithGrafanaUser(ctx context.Context) (context.Context, error) {
	// TODO: this relies on grafana populating the context with the user
	user, err := appcontext.User(ctx)
	if err != nil {
		// no user from grafana in context, look for a k8s user
		info, ok := request.UserFrom(ctx)
		if !ok {
			return ctx, fmt.Errorf("could not find k8s user info in context")
		}

		user = &grafanaUser.SignedInUser{
			UserID: -1,
			OrgID:  -1,
			Name:   info.GetName(),
			Login:  info.GetName(),
		}

		if info.GetName() == "system:apiserver" {
			user.UserID = 1
			user.OrgID = 1
		}

		v, ok := info.GetExtra()["user-id"]
		if ok && len(v) > 0 {
			user.UserID, err = strconv.ParseInt(v[0], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("couldn't determine the Grafana user id from extras map")
			}
		}
		v, ok = info.GetExtra()["org-id"]
		if ok && len(v) > 0 {
			user.OrgID, err = strconv.ParseInt(v[0], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("couldn't determine the Grafana org id from extras map")
			}
		}

		if user.OrgID < 0 || user.UserID < 0 {
			// Aggregated mode.... need to map this to a real user somehow
			user.OrgID = 1
			user.UserID = 1
			// return nil, fmt.Errorf("insufficient information on user context, couldn't determine UserID and OrgID")
		}

		// HACK alert... change to the requested org
		// TODO: should validate that user has access to that org/tenant
		ns, ok := request.NamespaceFrom(ctx)
		if ok && ns != "" {
			nsorg, err := util.NamespaceToOrgID(ns)
			if err != nil {
				return nil, err
			}
			user.OrgID = nsorg
		}

		ctx = appcontext.WithUser(ctx, user)
	}

	// set grpc metadata into the context to pass to the grpc server
	ctx = metadata.NewOutgoingContext(ctx, metadata.Pairs(
		"grafana-idtoken", user.IDToken,
		"grafana-userid", strconv.FormatInt(user.UserID, 10),
		"grafana-orgid", strconv.FormatInt(user.OrgID, 10),
		"grafana-login", user.Login,
	))

	return ctx, nil
}
