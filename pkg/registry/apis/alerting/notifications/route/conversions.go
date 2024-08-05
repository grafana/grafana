package route

import (
	"errors"
	"fmt"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	promModel "github.com/prometheus/common/model"

	model "github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func convertToK8sResource(orgID int64, r definitions.RoutingTree, namespacer request.NamespaceMapper) (*model.Route, error) {
	root := model.RouteSpec{
		Receiver:       r.Receiver,
		GroupBy:        r.GroupByStr,
		GroupWait:      optionalPrometheusDurationToString(r.GroupWait),
		GroupInterval:  optionalPrometheusDurationToString(r.GroupInterval),
		RepeatInterval: optionalPrometheusDurationToString(r.RepeatInterval),
		Routes:         make([]model.SubRoute, 0, len(r.Routes)),
	}
	for _, route := range r.Routes {
		if route == nil {
			continue
		}
		root.Routes = append(root.Routes, convertRouteToK8sSubRoute(route))
	}

	var result = &model.Route{
		TypeMeta: metav1.TypeMeta{
			Kind:       model.RouteResourceInfo.GroupVersionKind().Kind,
			APIVersion: model.VERSION,
		},
		ObjectMeta: metav1.ObjectMeta{
			// Name:            "default",
			Namespace:       namespacer(orgID),
			ResourceVersion: r.Version,
		},
		Spec: root,
	}
	result.SetProvenanceStatus(string(r.Provenance))
	return result, nil
}

func convertRouteToK8sSubRoute(r *definitions.Route) model.SubRoute {
	result := model.SubRoute{
		Receiver:          r.Receiver,
		GroupBy:           r.GroupByStr,
		MuteTimeIntervals: r.MuteTimeIntervals,
		Continue:          r.Continue,
		GroupWait:         optionalPrometheusDurationToString(r.GroupWait),
		GroupInterval:     optionalPrometheusDurationToString(r.GroupInterval),
		RepeatInterval:    optionalPrometheusDurationToString(r.RepeatInterval),
		Routes:            make([]model.SubRoute, 0, len(r.Routes)),
	}
	for _, m := range r.Matchers {
		result.Matchers = append(result.Matchers, model.Matcher{
			Label: m.Name,
			Type:  model.OperationType(m.Type.String()),
			Value: m.Value,
		})
	}
	for _, m := range r.ObjectMatchers {
		result.Matchers = append(result.Matchers, model.Matcher{
			Label: m.Name,
			Type:  model.OperationType(m.Type.String()),
			Value: m.Value,
		})
	}
	for _, route := range r.Routes {
		if route == nil {
			continue
		}
		result.Routes = append(result.Routes, convertRouteToK8sSubRoute(route))
	}
	return result
}

func convertToDomainModel(route *model.Route) (definitions.RoutingTree, error) {
	r := route.Spec
	result := definitions.Route{
		Receiver:   r.Receiver,
		GroupByStr: r.GroupBy,
		Routes:     make([]*definitions.Route, 0, len(r.Routes)),
	}
	path := "."
	var errs []error

	result.GroupWait = parsePrometheusDuration(r.GroupWait, func(err error) {
		errs = append(errs, fmt.Errorf("route '%s' has invalid format of 'groupWait': %w", path, err))
	})
	result.GroupWait = parsePrometheusDuration(r.GroupInterval, func(err error) {
		errs = append(errs, fmt.Errorf("route '%s' has invalid format of 'groupInterval': %w", path, err))
	})
	result.GroupWait = parsePrometheusDuration(r.RepeatInterval, func(err error) {
		errs = append(errs, fmt.Errorf("route '%s' has invalid format of 'repeatInterval': %w", path, err))
	})

	for idx, route := range r.Routes {
		p := fmt.Sprintf("%s[%d]", path, idx)
		s, err := convertK8sSubRouteToRoute(route, p)
		if len(err) > 0 {
			errs = append(errs, err...)
		} else {
			result.Routes = append(result.Routes, &s)
		}
	}
	if len(errs) > 0 {
		return definitions.RoutingTree{}, errors.Join(errs...)
	}
	tree := definitions.RoutingTree{
		Route:   result,
		Version: route.ResourceVersion,
	}
	tree.Provenance = ""
	return tree, nil
}

func convertK8sSubRouteToRoute(r model.SubRoute, path string) (definitions.Route, []error) {
	result := definitions.Route{
		Receiver:          r.Receiver,
		GroupByStr:        r.GroupBy,
		MuteTimeIntervals: r.MuteTimeIntervals,
		Continue:          r.Continue,
		Routes:            make([]*definitions.Route, 0, len(r.Routes)),
		Matchers:          make(config.Matchers, 0, len(r.Matchers)),
	}
	var errs []error
	result.GroupWait = parsePrometheusDuration(r.GroupWait, func(err error) {
		errs = append(errs, fmt.Errorf("route '%s' has invalid format of 'groupWait': %w", path, err))
	})
	result.GroupWait = parsePrometheusDuration(r.GroupInterval, func(err error) {
		errs = append(errs, fmt.Errorf("route '%s' has invalid format of 'groupInterval': %w", path, err))
	})
	result.GroupWait = parsePrometheusDuration(r.RepeatInterval, func(err error) {
		errs = append(errs, fmt.Errorf("route '%s' has invalid format of 'repeatInterval': %w", path, err))
	})

	for _, matcher := range r.Matchers {
		var mt labels.MatchType
		switch matcher.Type {
		case model.OperationTypeEqual:
			mt = labels.MatchEqual
		case model.OperationTypeNotEqual:
			mt = labels.MatchNotEqual
		case model.OperationTypeRegexMatch:
			mt = labels.MatchRegexp
		case model.OperationTypeRegexNoMatch:
			mt = labels.MatchNotRegexp
		default:
			errs = append(errs, fmt.Errorf("route '%s' has unsupported matcher type: %s", path, matcher.Type))
			continue
		}

		m, err := labels.NewMatcher(mt, matcher.Label, matcher.Value)
		if err != nil {
			errs = append(errs, fmt.Errorf("route '%s' has illegal matcher: %w", path, err))
			continue
		}
		result.Matchers = append(result.Matchers, m)
	}

	for idx, route := range r.Routes {
		p := fmt.Sprintf("%s[%d]", path, idx)
		s, err := convertK8sSubRouteToRoute(route, p)
		if len(err) > 0 {
			errs = append(errs, err...)
		} else {
			result.Routes = append(result.Routes, &s)
		}
	}
	return result, errs
}

func optionalPrometheusDurationToString(d *promModel.Duration) string {
	if d != nil {
		return d.String()
	}
	return ""
}

func parsePrometheusDuration(s string, callback func(e error)) *promModel.Duration {
	if s == "" {
		return nil
	}
	d, err := promModel.ParseDuration(s)
	if err != nil {
		callback(err)
	}
	return &d
}
