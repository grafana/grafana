package legacy_storage

import (
	"encoding/binary"
	"fmt"
	"hash"
	"hash/fnv"
	"maps"
	"slices"
	"strings"
	"unsafe"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/dispatch"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

const UserDefinedRoutingTreeName = "user-defined"
const NamedRouteMatcher = "__grafana_managed_route__"

type ManagedRoute struct {
	Name    string
	Version string

	Receiver       string
	GroupBy        []string
	GroupWait      *model.Duration
	GroupInterval  *model.Duration
	RepeatInterval *model.Duration
	Routes         []*definition.Route

	Provenance models.Provenance
}

func (r *ManagedRoute) AsAMRoute() definition.Route {
	return definition.Route{
		Receiver:       r.Receiver,
		GroupByStr:     r.GroupBy,
		GroupWait:      r.GroupWait,
		GroupInterval:  r.GroupInterval,
		RepeatInterval: r.RepeatInterval,
		Routes:         r.Routes,
		Provenance:     definitions.Provenance(r.Provenance),
	}
}

func (r *ManagedRoute) GeneratedSubRoute() *definition.Route {
	amRoute := r.AsAMRoute()

	// It's important that the generated sub-route is fully defined so that they will never rely on the values of the root.
	defaultOpts := dispatch.DefaultRouteOpts
	if amRoute.GroupWait == nil {
		gw := model.Duration(defaultOpts.GroupWait)
		amRoute.GroupWait = &gw
	}
	if amRoute.GroupInterval == nil {
		gi := model.Duration(defaultOpts.GroupInterval)
		amRoute.GroupInterval = &gi
	}
	if amRoute.RepeatInterval == nil {
		ri := model.Duration(defaultOpts.RepeatInterval)
		amRoute.RepeatInterval = &ri
	}
	if r.Name != UserDefinedRoutingTreeName {
		// Set label matcher.
		amRoute.ObjectMatchers = definitions.ObjectMatchers{&labels.Matcher{
			Type:  labels.MatchEqual,
			Name:  NamedRouteMatcher,
			Value: r.Name,
		}}
	}
	return &amRoute
}

func (r *ManagedRoute) ResourceType() string {
	return (&definition.Route{}).ResourceType()
}

func (r *ManagedRoute) ResourceID() string {
	if r.Name == UserDefinedRoutingTreeName {
		// Backwards compatibility with legacy user-defined routing tree.
		return ""
	}
	return r.Name
}

func NewManagedRoute(name string, r *definition.Route) *ManagedRoute {
	return &ManagedRoute{
		Name:    name,
		Version: CalculateRouteFingerprint(*r),

		Receiver:       r.Receiver,
		GroupBy:        r.GroupByStr,
		GroupWait:      r.GroupWait,
		GroupInterval:  r.GroupInterval,
		RepeatInterval: r.RepeatInterval,
		Routes:         r.Routes,

		Provenance: models.Provenance(r.Provenance),
	}
}

type ManagedRoutes []*ManagedRoute

func (m ManagedRoutes) Sort() {
	// Sort the keys of the map to ensure consistent ordering. Always ensure that the legacy user-defined routing tree is last.
	slices.SortFunc(m, func(a, b *ManagedRoute) int {
		if a.Name == UserDefinedRoutingTreeName {
			return 1
		}
		if b.Name == UserDefinedRoutingTreeName {
			return -1
		}
		return strings.Compare(a.Name, b.Name)
	})
}

func WithManagedRoutes(root *definitions.Route, managedRoutes map[string]*definition.Route) *definitions.Route {
	if len(managedRoutes) == 0 {
		// If there are no managed routes, we just return the original root.
		return root
	}
	newRoot := *root
	newManagedRoutes := make([]*definition.Route, 0, len(newRoot.Routes)+len(managedRoutes))
	for _, k := range slices.Sorted(maps.Keys(managedRoutes)) {
		// On the off chance that the route is nil or invalid managed route with the restricted name, we skip it.
		if managedRoutes[k] == nil || k == UserDefinedRoutingTreeName {
			continue
		}
		newManagedRoutes = append(newManagedRoutes, NewManagedRoute(k, managedRoutes[k]).GeneratedSubRoute())
	}

	// Add the user-defined routing tree at the end.
	newManagedRoutes = append(newManagedRoutes, newRoot.Routes...)
	newRoot.Routes = newManagedRoutes
	return &newRoot
}

func (rev *ConfigRevision) GetManagedRoute(name string) *ManagedRoute {
	if name == UserDefinedRoutingTreeName {
		return NewManagedRoute(UserDefinedRoutingTreeName, rev.Config.AlertmanagerConfig.Route)
	}
	route, ok := rev.Config.ManagedRoutes[name]
	if !ok {
		return nil
	}
	return NewManagedRoute(name, route)
}

func (rev *ConfigRevision) GetManagedRoutes() ManagedRoutes {
	managedRoutes := make(ManagedRoutes, 0, len(rev.Config.ManagedRoutes)+1)
	for _, k := range slices.Sorted(maps.Keys(rev.Config.ManagedRoutes)) {
		// On the off chance that the route is nil or invalid managed route with the restricted name, we skip it.
		if rev.Config.ManagedRoutes[k] == nil || k == UserDefinedRoutingTreeName {
			continue
		}
		managedRoutes = append(managedRoutes, NewManagedRoute(k, rev.Config.ManagedRoutes[k]))
	}

	managedRoutes = append(managedRoutes, NewManagedRoute(UserDefinedRoutingTreeName, rev.Config.AlertmanagerConfig.Route))

	return managedRoutes
}

func (rev *ConfigRevision) DeleteManagedRoute(name string) {
	// Intentionally does not consider if name == UserDefinedRoutingTreeName as it should only be Reset via Update.
	delete(rev.Config.ManagedRoutes, name)
}

func (rev *ConfigRevision) CreateManagedRoute(name string, subtree definitions.Route) (*ManagedRoute, error) {
	if name == "" {
		return nil, fmt.Errorf("route name is required")
	}

	if name == UserDefinedRoutingTreeName {
		return nil, fmt.Errorf("cannot create a managed route with the name %q, this name is reserved for the user-defined routing tree", UserDefinedRoutingTreeName)
	}

	if _, exists := rev.Config.ManagedRoutes[name]; exists {
		return nil, ErrRouteExists.Errorf("")
	}

	managedRoute := NewManagedRoute(name, &subtree)
	amRoute := managedRoute.AsAMRoute()

	err := rev.ValidateRoute(amRoute)
	if err != nil {
		return nil, MakeErrRouteInvalidFormat(err)
	}

	if rev.Config.ManagedRoutes == nil {
		rev.Config.ManagedRoutes = make(map[string]*definition.Route, 1)
	}
	rev.Config.ManagedRoutes[name] = &amRoute

	return managedRoute, nil
}

func (rev *ConfigRevision) UpdateNamedRoute(name string, subtree definitions.Route) (*ManagedRoute, error) {
	if name == "" {
		return nil, fmt.Errorf("route name is required")
	}

	if existing := rev.GetManagedRoute(name); existing == nil {
		return nil, fmt.Errorf("managed route %q not found", name)
	}

	managedRoute := NewManagedRoute(name, &subtree)
	amRoute := managedRoute.AsAMRoute()

	err := rev.ValidateRoute(amRoute)
	if err != nil {
		return nil, MakeErrRouteInvalidFormat(err)
	}

	if name == UserDefinedRoutingTreeName {
		rev.Config.AlertmanagerConfig.Route = &amRoute
	} else {
		if rev.Config.ManagedRoutes == nil {
			rev.Config.ManagedRoutes = make(map[string]*definition.Route, 1)
		}
		rev.Config.ManagedRoutes[name] = &amRoute
	}

	return managedRoute, nil
}

func (rev *ConfigRevision) ValidateRoute(route definitions.Route) error {
	err := route.Validate()
	if err != nil {
		return MakeErrRouteInvalidFormat(err)
	}

	err = rev.validateRouteReferences(route)
	if err != nil {
		return MakeErrRouteInvalidFormat(err)
	}
	return nil
}

func (rev *ConfigRevision) validateRouteReferences(route definitions.Route) error {
	receivers := map[string]struct{}{}
	receivers[""] = struct{}{} // Allow empty receiver (inheriting from parent)
	for _, receiver := range rev.GetReceivers(nil) {
		receivers[receiver.Name] = struct{}{}
	}

	err := route.ValidateReceivers(receivers)
	if err != nil {
		return err
	}

	timeIntervals := map[string]struct{}{}
	for _, mt := range rev.Config.AlertmanagerConfig.MuteTimeIntervals {
		timeIntervals[mt.Name] = struct{}{}
	}
	for _, mt := range rev.Config.AlertmanagerConfig.TimeIntervals {
		timeIntervals[mt.Name] = struct{}{}
	}
	err = route.ValidateTimeIntervals(timeIntervals)
	if err != nil {
		return err
	}
	return nil
}

func CalculateRouteFingerprint(route definitions.Route) string {
	sum := fnv.New64a()
	writeToHash(sum, &route)
	return fmt.Sprintf("%016x", sum.Sum64())
}

func writeToHash(sum hash.Hash, r *definitions.Route) {
	writeBytes := func(b []byte) {
		_, _ = sum.Write(b)
		// add a byte sequence that cannot happen in UTF-8 strings.
		_, _ = sum.Write([]byte{255})
	}
	writeString := func(s string) {
		if len(s) == 0 {
			writeBytes(nil)
			return
		}
		// #nosec G103
		// avoid allocation when converting string to byte slice
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s)))
	}

	// this temp slice is used to convert ints to bytes.
	tmp := make([]byte, 8)
	writeInt := func(u int64) {
		binary.LittleEndian.PutUint64(tmp, uint64(u))
		writeBytes(tmp)
	}
	writeBool := func(b bool) {
		if b {
			writeInt(1)
		} else {
			writeInt(0)
		}
	}
	writeDuration := func(d *model.Duration) {
		if d == nil {
			_, _ = sum.Write([]byte{255})
		} else {
			binary.LittleEndian.PutUint64(tmp, uint64(*d))
			_, _ = sum.Write(tmp)
			_, _ = sum.Write([]byte{255})
		}
	}

	writeString(r.Receiver)
	for _, s := range r.GroupByStr {
		writeString(s)
	}
	for _, labelName := range r.GroupBy {
		writeString(string(labelName))
	}
	writeBool(r.GroupByAll)
	if len(r.Match) > 0 {
		for _, key := range slices.Sorted(maps.Keys(r.Match)) {
			writeString(key)
			writeString(r.Match[key])
		}
	}
	if len(r.MatchRE) > 0 {
		for _, key := range slices.Sorted(maps.Keys(r.MatchRE)) {
			writeString(key)
			str, err := r.MatchRE[key].MarshalJSON()
			if err != nil {
				writeString(fmt.Sprintf("%+v", r.MatchRE))
			}
			writeBytes(str)
		}
	}
	for _, matcher := range r.Matchers {
		writeString(matcher.String())
	}
	for _, matcher := range r.ObjectMatchers {
		writeString(matcher.String())
	}
	for _, timeInterval := range r.MuteTimeIntervals {
		writeString(timeInterval)
	}
	for _, timeInterval := range r.ActiveTimeIntervals {
		writeString(timeInterval)
	}
	writeBool(r.Continue)
	writeDuration(r.GroupWait)
	writeDuration(r.GroupInterval)
	writeDuration(r.RepeatInterval)
	for _, route := range r.Routes {
		writeToHash(sum, route)
	}
}
