package routingtree

import (
	"errors"
	"fmt"
	"maps"
	"slices"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	promModel "github.com/prometheus/common/model"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/util"
)

func ConvertToK8sResource(orgID int64, r definitions.Route, version string, namespacer request.NamespaceMapper) (*model.RoutingTree, error) {
	spec := model.RoutingTreeSpec{
		Defaults: model.RoutingTreeRouteDefaults{
			GroupBy:        r.GroupByStr,
			GroupWait:      optionalPrometheusDurationToString(r.GroupWait),
			GroupInterval:  optionalPrometheusDurationToString(r.GroupInterval),
			RepeatInterval: optionalPrometheusDurationToString(r.RepeatInterval),
			Receiver:       r.Receiver,
		},
	}
	for _, route := range r.Routes {
		if route == nil {
			continue
		}
		spec.Routes = append(spec.Routes, convertRouteToK8sSubRoute(route))
	}

	var result = &model.RoutingTree{
		ObjectMeta: metav1.ObjectMeta{
			Name:            model.UserDefinedRoutingTreeName,
			Namespace:       namespacer(orgID),
			ResourceVersion: version,
		},
		Spec: spec,
	}
	result.SetProvenanceStatus(string(r.Provenance))
	result.UID = gapiutil.CalculateClusterWideUID(result)
	return result, nil
}

func convertRouteToK8sSubRoute(r *definitions.Route) model.RoutingTreeRoute {
	result := model.RoutingTreeRoute{
		GroupBy:             r.GroupByStr,
		MuteTimeIntervals:   r.MuteTimeIntervals,
		ActiveTimeIntervals: r.ActiveTimeIntervals,
		Continue:            r.Continue,
		GroupWait:           optionalPrometheusDurationToString(r.GroupWait),
		GroupInterval:       optionalPrometheusDurationToString(r.GroupInterval),
		RepeatInterval:      optionalPrometheusDurationToString(r.RepeatInterval),
		Routes:              make([]model.RoutingTreeRoute, 0, len(r.Routes)),
	}
	if r.Receiver != "" {
		result.Receiver = util.Pointer(r.Receiver)
	}

	if r.Match != nil {
		keys := slices.Collect(maps.Keys(r.Match))
		slices.Sort(keys)
		for _, key := range keys {
			result.Matchers = append(result.Matchers, model.RoutingTreeMatcher{
				Label: key,
				Type:  model.RoutingTreeMatcherTypeEqual,
				Value: r.Match[key],
			})
		}
	}

	if r.MatchRE != nil {
		keys := slices.Collect(maps.Keys(r.MatchRE))
		slices.Sort(keys)
		for _, key := range keys {
			m := model.RoutingTreeMatcher{
				Label: key,
				Type:  model.RoutingTreeMatcherTypeEqualRegex,
			}
			value, _ := r.MatchRE[key].MarshalYAML()
			if s, ok := value.(string); ok {
				m.Value = s
			}
			result.Matchers = append(result.Matchers, m)
		}
	}

	for _, m := range r.Matchers {
		result.Matchers = append(result.Matchers, model.RoutingTreeMatcher{
			Label: m.Name,
			Type:  model.RoutingTreeMatcherType(m.Type.String()),
			Value: m.Value,
		})
	}
	for _, m := range r.ObjectMatchers {
		result.Matchers = append(result.Matchers, model.RoutingTreeMatcher{
			Label: m.Name,
			Type:  model.RoutingTreeMatcherType(m.Type.String()),
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

func convertToDomainModel(obj *model.RoutingTree) (definitions.Route, string, error) {
	defaults := obj.Spec.Defaults
	result := definitions.Route{
		Receiver:   defaults.Receiver,
		GroupByStr: defaults.GroupBy,
		Routes:     make([]*definitions.Route, 0, len(obj.Spec.Routes)),
	}
	path := "."
	var errs []error

	result.GroupWait = parsePrometheusDuration(defaults.GroupWait, func(err error) {
		errs = append(errs, fmt.Errorf("obj '%s' has invalid format of 'groupWait': %w", path, err))
	})
	result.GroupInterval = parsePrometheusDuration(defaults.GroupInterval, func(err error) {
		errs = append(errs, fmt.Errorf("obj '%s' has invalid format of 'groupInterval': %w", path, err))
	})
	result.RepeatInterval = parsePrometheusDuration(defaults.RepeatInterval, func(err error) {
		errs = append(errs, fmt.Errorf("obj '%s' has invalid format of 'repeatInterval': %w", path, err))
	})

	for idx, route := range obj.Spec.Routes {
		p := fmt.Sprintf("%s[%d]", path, idx)
		s, err := convertK8sSubRouteToRoute(route, p)
		if len(err) > 0 {
			errs = append(errs, err...)
		} else {
			result.Routes = append(result.Routes, &s)
		}
	}
	if len(errs) > 0 {
		return definitions.Route{}, "", errors.Join(errs...)
	}
	result.Provenance = ""
	return result, obj.ResourceVersion, nil
}

func convertK8sSubRouteToRoute(r model.RoutingTreeRoute, path string) (definitions.Route, []error) {
	result := definitions.Route{
		GroupByStr:          r.GroupBy,
		MuteTimeIntervals:   r.MuteTimeIntervals,
		ActiveTimeIntervals: r.ActiveTimeIntervals,
		Routes:              make([]*definitions.Route, 0, len(r.Routes)),
		Matchers:            make(config.Matchers, 0, len(r.Matchers)),
		Continue:            r.Continue,
	}
	if r.Receiver != nil {
		result.Receiver = *r.Receiver
	}
	var errs []error
	result.GroupWait = parsePrometheusDuration(r.GroupWait, func(err error) {
		errs = append(errs, fmt.Errorf("route '%s' has invalid format of 'groupWait': %w", path, err))
	})
	result.GroupInterval = parsePrometheusDuration(r.GroupInterval, func(err error) {
		errs = append(errs, fmt.Errorf("route '%s' has invalid format of 'groupInterval': %w", path, err))
	})
	result.RepeatInterval = parsePrometheusDuration(r.RepeatInterval, func(err error) {
		errs = append(errs, fmt.Errorf("route '%s' has invalid format of 'repeatInterval': %w", path, err))
	})

	for _, matcher := range r.Matchers {
		var mt labels.MatchType
		switch matcher.Type {
		case model.RoutingTreeMatcherTypeEqual:
			mt = labels.MatchEqual
		case model.RoutingTreeMatcherTypeNotEqual:
			mt = labels.MatchNotEqual
		case model.RoutingTreeMatcherTypeEqualRegex:
			mt = labels.MatchRegexp
		case model.RoutingTreeMatcherTypeNotEqualRegex:
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
		result.ObjectMatchers = append(result.ObjectMatchers, m)
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

func optionalPrometheusDurationToString(d *promModel.Duration) *string {
	if d != nil {
		result := d.String()
		return &result
	}
	return nil
}

func parsePrometheusDuration(s *string, callback func(e error)) *promModel.Duration {
	if s == nil || *s == "" {
		return nil
	}
	d, err := promModel.ParseDuration(*s)
	if err != nil {
		callback(err)
		return nil
	}
	return &d
}
