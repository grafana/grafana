package serviceaccount

import (
	"context"
	"strings"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/setting"
)

func MutateOnCreate(ctx context.Context, obj *iamv0alpha1.ServiceAccount, cfg *setting.Cfg) error {
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return err
	}

	login := serviceaccounts.GenerateLogin(serviceaccounts.ServiceAccountPrefix, ns.OrgID, obj.Spec.Title)
	if obj.Spec.External {
		login = serviceaccounts.ExtSvcLoginPrefix(ns.OrgID) + slugify.Slugify(obj.Spec.Title)
	}

	obj.Spec.Login = strings.ToLower(login)
	obj.Name = obj.Spec.Login

	// External service accounts have None org role by default
	if obj.Spec.External {
		obj.Spec.Role = iamv0alpha1.ServiceAccountOrgRoleNone

		if !strings.HasPrefix(obj.Spec.Title, serviceaccounts.ExtSvcPrefix) {
			obj.Spec.Title = serviceaccounts.ExtSvcPrefix + obj.Spec.Title
		}
	}

	obj.Spec.AvatarUrl = dtos.GetGravatarUrlWithDefault(cfg, "", obj.Spec.Title)

	return nil
}
