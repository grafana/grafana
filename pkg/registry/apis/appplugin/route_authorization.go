package appplugin

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	authsvc "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

const (
	declaredAuthzResource    = "x-grafana-declared-authz-resource"
	declaredAuthzSubresource = "x-grafana-declared-authz-subresource"
	declaredAuthzVerb        = "x-grafana-declared-authz-verb"
)

type declaredRouteCheck struct {
	resource    string
	subresource *string
	verb        string
}

func declaredRouteChecks(props spec3.PathProps) (map[string]declaredRouteCheck, error) {
	checks := make(map[string]declaredRouteCheck)
	for method, op := range builder.GetPathOperations(&props) {
		var check declaredRouteCheck
		declared := false
		for key, value := range op.Extensions {
			if !strings.HasPrefix(key, "x-grafana-") {
				continue
			}
			switch key {
			case declaredAuthzResource, declaredAuthzSubresource, declaredAuthzVerb:
			default:
				return nil, fmt.Errorf("%s: unsupported extension %q", method, key)
			}
			declared = true
			s, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("%s: %s must be a string", method, key)
			}
			switch key {
			case declaredAuthzResource:
				if strings.TrimSpace(s) == "" {
					return nil, fmt.Errorf("%s: %s must not be empty", method, key)
				}
				check.resource = s
			case declaredAuthzSubresource:
				check.subresource = &s
			case declaredAuthzVerb:
				switch s {
				case "get", "list", "watch", "create", "update", "patch", "delete", "deletecollection":
					check.verb = s
				default:
					return nil, fmt.Errorf("%s: unsupported declared authorization verb %q", method, s)
				}
			}
		}
		if declared {
			if check.resource == "" {
				return nil, fmt.Errorf("%s: %s is required", method, declaredAuthzResource)
			}
			checks[method] = check
		}
	}
	return checks, nil
}

func validateManifestRouteAuthorization(manifest *app.ManifestData) error {
	if manifest == nil {
		return nil
	}
	for _, version := range manifest.Versions {
		validate := func(scope string, routes map[string]spec3.PathProps) error {
			for path, props := range routes {
				if _, err := declaredRouteChecks(props); err != nil {
					return fmt.Errorf("version %q %s route %q: %w", version.Name, scope, path, err)
				}
			}
			return nil
		}
		if err := validate("cluster", version.Routes.Cluster); err != nil {
			return err
		}
		if err := validate("namespaced", version.Routes.Namespaced); err != nil {
			return err
		}
		for _, kind := range version.Kinds {
			if err := validate("kind "+kind.Kind, kind.Routes); err != nil {
				return err
			}
		}
	}
	return nil
}

func (b *AppPluginAPIBuilder) withDeclaredRouteAuthorization(gv schema.GroupVersion, resource, path string, props spec3.PathProps, next http.HandlerFunc) http.HandlerFunc {
	checks, compileErr := declaredRouteChecks(props)
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if compileErr != nil {
			_ = errhttp.Write(ctx, apierrors.NewInternalError(compileErr), w)
			return
		}
		check, declared := checks[r.Method]
		if !declared {
			next(w, r)
			return
		}
		info, ok := request.RequestInfoFrom(ctx)
		if !ok || b.opts.RouteAccessChecker == nil {
			_ = errhttp.Write(ctx, apierrors.NewInternalError(errors.New("route authorization is not configured")), w)
			return
		}
		attrs := authorizer.AttributesRecord{
			APIGroup:        gv.Group,
			APIVersion:      gv.Version,
			Resource:        check.resource,
			Namespace:       mux.Vars(r)[namespaceParameter],
			Verb:            info.Verb,
			Path:            r.URL.Path,
			ResourceRequest: true,
		}
		// Version routes can resemble resource URLs without addressing an object.
		// Only kind routes give the name and subresource resource semantics.
		if resource != "" {
			attrs.Name = mux.Vars(r)[nameParameter]
			attrs.Subresource, _, _ = strings.Cut(strings.TrimPrefix(path, "/"), "/")
		}
		if check.subresource != nil {
			attrs.Subresource = *check.subresource
		}
		if check.verb != "" {
			attrs.Verb = check.verb
		}
		decision, _, err := authsvc.NewResourceAuthorizer(b.opts.RouteAccessChecker).Authorize(ctx, attrs)
		if err != nil {
			_ = errhttp.Write(ctx, apierrors.NewInternalError(err), w)
			return
		}
		if decision != authorizer.DecisionAllow {
			_ = errhttp.Write(ctx, apierrors.NewForbidden(gv.WithResource(check.resource).GroupResource(), attrs.Name, errors.New("access denied")), w)
			return
		}
		next(w, r)
	}
}
