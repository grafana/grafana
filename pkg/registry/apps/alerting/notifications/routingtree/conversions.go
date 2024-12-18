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

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/routingtree/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/util"
)

func convertToK8sResource(orgID int64, r definitions.Route, version string, namespacer request.NamespaceMapper) (*model.RoutingTree, error) {
	spec := model.Spec{
		Defaults: model.RouteDefaults{
			GroupBy:        r.GroupByStr,
			GroupWait:      optionalPrometheusDurationToString(r.GroupWait),
			GroupInterval:  optionalPrometheusDurationToString(r.GroupInterval),
			RepeatInterval: optionalPrometheusDurationToString(r.RepeatInterval),
			Receiver:       r.Receiver,
		},
		Routes: convertToApiModels(r.Routes),
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

func convertRouteToK8sSubRoute(r *definitions.Route) model.Route {
	result := model.Route{
		GroupBy:           r.GroupByStr,
		MuteTimeIntervals: r.MuteTimeIntervals,
		Continue:          r.Continue,
		GroupWait:         optionalPrometheusDurationToString(r.GroupWait),
		GroupInterval:     optionalPrometheusDurationToString(r.GroupInterval),
		RepeatInterval:    optionalPrometheusDurationToString(r.RepeatInterval),
		Routes:            make([]model.Route2, 0, len(r.Routes)),
	}
	if r.Receiver != "" {
		result.Receiver = util.Pointer(r.Receiver)
	}

	if r.Match != nil {
		keys := slices.Collect(maps.Keys(r.Match))
		slices.Sort(keys)
		for _, key := range keys {
			result.Matchers = append(result.Matchers, model.Matcher{
				Label: key,
				Type:  model.MatcherTypeEqual,
				Value: r.Match[key],
			})
		}
	}

	if r.MatchRE != nil {
		keys := slices.Collect(maps.Keys(r.MatchRE))
		slices.Sort(keys)
		for _, key := range keys {
			m := model.Matcher{
				Label: key,
				Type:  model.MatcherTypeEqualTilde,
			}
			value, _ := r.MatchRE[key].MarshalYAML()
			if s, ok := value.(string); ok {
				m.Value = s
			}
			result.Matchers = append(result.Matchers, m)
		}
	}

	for _, m := range r.Matchers {
		result.Matchers = append(result.Matchers, model.Matcher{
			Label: m.Name,
			Type:  model.MatcherType(m.Type.String()),
			Value: m.Value,
		})
	}
	for _, m := range r.ObjectMatchers {
		result.Matchers = append(result.Matchers, model.Matcher{
			Label: m.Name,
			Type:  model.MatcherType(m.Type.String()),
			Value: m.Value,
		})
	}
	return result
}

func convertToDomainModel(obj *model.RoutingTree) (definitions.Route, string, error) {
	defaults := obj.Spec.Defaults

	routes, errs := convertToDomainModels(obj.Spec.Routes)

	result := definitions.Route{
		Receiver:   defaults.Receiver,
		GroupByStr: defaults.GroupBy,
		Routes:     routes,
	}

	result.GroupWait = parsePrometheusDuration(defaults.GroupWait, func(err error) {
		errs = append(errs, fmt.Errorf("field '%s' has invalid format: %w", ".groupWait", err))
	})
	result.GroupInterval = parsePrometheusDuration(defaults.GroupInterval, func(err error) {
		errs = append(errs, fmt.Errorf("field '%s' has invalid format: %w", ".groupInterval", err))
	})
	result.RepeatInterval = parsePrometheusDuration(defaults.RepeatInterval, func(err error) {
		errs = append(errs, fmt.Errorf("field '%s' has invalid format: %w", ".repeatInterval", err))
	})
	if len(errs) > 0 {
		return definitions.Route{}, "", errors.Join(errs...)
	}
	result.Provenance = ""
	return result, obj.ResourceVersion, nil
}

func convertK8sSubRouteToRoute(r model.Route, subRoutes []*definitions.Route, path string) (definitions.Route, []error) {
	result := definitions.Route{
		GroupByStr:        r.GroupBy,
		MuteTimeIntervals: r.MuteTimeIntervals,
		Routes:            subRoutes,
		Matchers:          make(config.Matchers, 0, len(r.Matchers)),
		Continue:          r.Continue,
	}
	if r.Receiver != nil {
		result.Receiver = *r.Receiver
	}
	var errs []error
	result.GroupWait = parsePrometheusDuration(r.GroupWait, func(err error) {
		errs = append(errs, fmt.Errorf("field '%s.groupWait' has invalid format: %w", path, err))
	})
	result.GroupInterval = parsePrometheusDuration(r.GroupInterval, func(err error) {
		errs = append(errs, fmt.Errorf("field '%s.groupInterval' has invalid format: %w", path, err))
	})
	result.RepeatInterval = parsePrometheusDuration(r.RepeatInterval, func(err error) {
		errs = append(errs, fmt.Errorf("route '%s.repeatInterval' has invalid format: %w", path, err))
	})

	for idx, matcher := range r.Matchers {
		var mt labels.MatchType
		switch matcher.Type {
		case model.MatcherTypeEqual:
			mt = labels.MatchEqual
		case model.MatcherTypeNotEqual:
			mt = labels.MatchNotEqual
		case model.MatcherTypeEqualRegex:
			mt = labels.MatchRegexp
		case model.MatcherTypeNotEqualRegex:
			mt = labels.MatchNotRegexp
		default:
			errs = append(errs, fmt.Errorf("field '%s.matchers[%d].type' contains unknown type: %s", path, idx, matcher.Type))
			continue
		}

		m, err := labels.NewMatcher(mt, matcher.Label, matcher.Value)
		if err != nil {
			errs = append(errs, fmt.Errorf("field '%s.matches[%d]' has illegal matcher: %w", path, idx, err))
			continue
		}
		result.ObjectMatchers = append(result.ObjectMatchers, m)
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

func convertToApiModels(r []*definitions.Route) []model.Route {
	routeToRoute2 := func(route model.Route) model.Route2 {
		return model.Route2{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			Continue:          route.Continue,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	routeToRoute3 := func(route model.Route) model.Route3 {
		return model.Route3{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			Continue:          route.Continue,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	routeToRoute4 := func(route model.Route) model.Route4 {
		return model.Route4{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			Continue:          route.Continue,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	routeToRoute5 := func(route model.Route) model.Route5 {
		return model.Route5{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			Continue:          route.Continue,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	routeToRoute6 := func(route model.Route) model.Route6 {
		return model.Route6{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			Continue:          route.Continue,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	routeToLeafRoute := func(route model.Route) model.LeafRoute {
		return model.LeafRoute{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	result := make([]model.Route, 0, len(r))
	for _, r1 := range r {
		if r1 == nil {
			continue
		}
		var routes2 []model.Route2
		for _, r2 := range r1.Routes {
			if r2 == nil {
				continue
			}
			var routes3 []model.Route3
			for _, r3 := range r2.Routes {
				if r3 == nil {
					continue
				}
				var routes4 []model.Route4
				for _, r4 := range r3.Routes {
					if r4 == nil {
						continue
					}
					var routes5 []model.Route5
					for _, r5 := range r4.Routes {
						if r5 == nil {
							continue
						}
						var routes6 []model.Route6
						for _, r6 := range r5.Routes {
							if r6 == nil {
								continue
							}
							var leafRoutes []model.LeafRoute
							for _, leaf := range r6.Routes {
								if leaf == nil {
									continue
								}
								leafRoutes = append(leafRoutes, routeToLeafRoute(convertRouteToK8sSubRoute(leaf)))
							}
							r6m := routeToRoute6(convertRouteToK8sSubRoute(r6))
							r6m.Routes = leafRoutes
							routes6 = append(routes6, r6m)
						}
						r5m := routeToRoute5(convertRouteToK8sSubRoute(r5))
						r5m.Routes = routes6
						routes5 = append(routes5, r5m)
					}
					r4m := routeToRoute4(convertRouteToK8sSubRoute(r4))
					r4m.Routes = routes5
					routes4 = append(routes4, r4m)
				}
				r3m := routeToRoute3(convertRouteToK8sSubRoute(r3))
				r3m.Routes = routes4
				routes3 = append(routes3, r3m)
			}
			r2m := routeToRoute2(convertRouteToK8sSubRoute(r2))
			r2m.Routes = routes3
			routes2 = append(routes2, r2m)
		}
		r1m := convertRouteToK8sSubRoute(r1)
		r1m.Routes = routes2
		result = append(result, r1m)
	}

	// Return the fully-built tree
	return result
}

func convertToDomainModels(routes []model.Route) ([]*definitions.Route, []error) {
	route2ToRoute := func(route model.Route2) model.Route {
		return model.Route{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			Continue:          route.Continue,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	route3ToRoute := func(route model.Route3) model.Route {
		return model.Route{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			Continue:          route.Continue,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	route4ToRoute := func(route model.Route4) model.Route {
		return model.Route{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			Continue:          route.Continue,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	route5ToRoute := func(route model.Route5) model.Route {
		return model.Route{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			Continue:          route.Continue,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	route6ToRoute := func(route model.Route6) model.Route {
		return model.Route{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			Continue:          route.Continue,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	leafRouteToRoute := func(route model.LeafRoute) model.Route {
		return model.Route{
			GroupBy:           route.GroupBy,
			MuteTimeIntervals: route.MuteTimeIntervals,
			GroupWait:         route.GroupWait,
			GroupInterval:     route.GroupInterval,
			RepeatInterval:    route.RepeatInterval,
			Receiver:          route.Receiver,
			Matchers:          route.Matchers,
		}
	}

	result := make([]*definitions.Route, 0, len(routes))
	var e []error
	for idx1, r1 := range routes {
		path1 := fmt.Sprintf(".routes[%d]", idx1)
		routes2 := make([]*definitions.Route, 0, len(r1.Routes))

		for idx2, r2 := range r1.Routes {
			path2 := fmt.Sprintf("%s.routes[%d]", path1, idx2)

			routes3 := make([]*definitions.Route, 0, len(r2.Routes))
			for idx3, r3 := range r2.Routes {
				path3 := fmt.Sprintf("%s.routes[%d]", path2, idx3)
				routes4 := make([]*definitions.Route, 0, len(r3.Routes))

				for idx4, r4 := range r3.Routes {
					path4 := fmt.Sprintf("%s.routes[%d]", path3, idx4)
					routes5 := make([]*definitions.Route, 0, len(r4.Routes))

					for idx5, r5 := range r4.Routes {
						path5 := fmt.Sprintf("%s.routes[%d]", path4, idx5)
						routes6 := make([]*definitions.Route, 0, len(r5.Routes))

						for idx6, r6 := range r5.Routes {
							path6 := fmt.Sprintf("%s.routes[%d]", path5, idx6)
							routes7 := make([]*definitions.Route, 0, len(r6.Routes))

							for idx7, r7 := range r6.Routes {
								path7 := fmt.Sprintf("%s.routes[%d]", path6, idx7)
								r7d, err := convertK8sSubRouteToRoute(leafRouteToRoute(r7), nil, path7)
								if len(err) > 0 {
									e = append(e, err...)
									continue
								}
								routes7 = append(routes7, &r7d)
							}

							r6d, err := convertK8sSubRouteToRoute(route6ToRoute(r6), routes7, path6)
							if len(err) > 0 {
								e = append(e, err...)
								continue
							}
							routes6 = append(routes6, &r6d)
						}

						r5d, err := convertK8sSubRouteToRoute(route5ToRoute(r5), routes6, path5)
						if len(err) > 0 {
							e = append(e, err...)
							continue
						}
						routes5 = append(routes5, &r5d)
					}

					r4Route := route4ToRoute(r4)
					r4d, err := convertK8sSubRouteToRoute(r4Route, routes5, path4)
					if len(err) > 0 {
						e = append(e, err...)
						continue
					}
					routes4 = append(routes4, &r4d)
				}

				r3Route := route3ToRoute(r3)
				r3d, err := convertK8sSubRouteToRoute(r3Route, routes4, path3)
				if len(err) > 0 {
					e = append(e, err...)
					continue
				}
				routes3 = append(routes3, &r3d)
			}

			r2d, err := convertK8sSubRouteToRoute(route2ToRoute(r2), routes3, path2)
			if len(err) > 0 {
				e = append(e, err...)
				continue
			}
			routes2 = append(routes2, &r2d)
		}

		r1d, err := convertK8sSubRouteToRoute(r1, routes2, path1)
		if len(err) > 0 {
			e = append(e, err...)
			continue
		}
		result = append(result, &r1d)
	}
	if len(e) > 0 {
		return nil, e
	}
	return result, nil
}
