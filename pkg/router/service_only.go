package router

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

const routerSection = "router"

// serviceOnlyGroupsFromConfig reads [router] service_only_groups: the groups
// only services may use.
func serviceOnlyGroupsFromConfig(cfg *setting.Cfg) (map[string]bool, error) {
	groups := map[string]bool{}
	if cfg == nil {
		return groups, nil
	}
	for _, group := range util.SplitString(cfg.SectionWithEnvOverrides(routerSection).Key("service_only_groups").MustString("")) {
		if !utils.IsAPIGroup(group) || group == discoveryGroup {
			return nil, fmt.Errorf("%s: service_only_groups: invalid group %q", routerSection, group)
		}
		groups[group] = true
	}
	return groups, nil
}

// isService reports whether ctx's requester is a service.
func isService(ctx context.Context) bool {
	requester, err := identity.GetRequester(ctx)
	return err == nil && requester != nil && requester.IsIdentityType(types.TypeAccessPolicy)
}

// withoutServiceOnly returns the backends whose group is not service-only.
func (r *GrafanaRouter) withoutServiceOnly(backends []Backend) []Backend {
	out := make([]Backend, 0, len(backends))
	for _, b := range backends {
		if !r.serviceOnly[b.Group().Name] {
			out = append(out, b)
		}
	}
	return out
}

// authorizeGroup refuses a request for a service-only group from anyone but a
// service, before any backend or stack sees it.
func (r *GrafanaRouter) authorizeGroup(w http.ResponseWriter, req *http.Request, group string) bool {
	if !r.serviceOnly[group] || isService(req.Context()) {
		return true
	}
	setRoute(req, routeForbidden)
	_ = errhttp.Write(req.Context(), apierrors.NewForbidden(
		schema.GroupResource{Group: group}, "",
		fmt.Errorf("the %q group is only available to services", group),
	), w)
	return false
}
