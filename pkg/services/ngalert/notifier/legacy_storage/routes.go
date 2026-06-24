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
	k8svalidation "k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
)

const NamedRouteMatcher = models.NamedRouteLabel

type ManagedRoute struct {
	Name    string
	Version string

	Receiver       string
	GroupBy        []string
	GroupWait      *model.Duration
	GroupInterval  *model.Duration
	RepeatInterval *model.Duration
	Routes         []*v1.Route

	Provenance models.Provenance
	Origin     models.ResourceOrigin
}

func (r *ManagedRoute) GeneratedSubRoute() *v1.Route {
	amRoute := ManagedRouteToRoute(r)

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
	if !models.IsDefaultRoutingTreeName(r.Name) {
		// Set label matcher.
		amRoute.ObjectMatchers = v1.ObjectMatchers{managedRouteMatcher(r.Name)}
	}
	return &amRoute
}

func (r *ManagedRoute) GetUID() string {
	// Canonicalize so the default tree has a single stable identity regardless of whether
	// it was addressed by its canonical name or the legacy alias. This identity backs RBAC scopes.
	return models.CanonicalizeRoutingTreeName(r.Name)
}

func (r *ManagedRoute) ResourceType() string {
	return (&definition.Route{}).ResourceType()
}

func (r *ManagedRoute) ResourceID() string {
	if models.IsDefaultRoutingTreeName(r.Name) {
		// Backwards compatibility with the legacy default (root) routing tree.
		return ""
	}
	return r.Name
}

func NewManagedRoute(name string, r *v1.Route) *ManagedRoute {
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
		Origin:     models.ResourceOriginGrafana,
	}
}

func managedRouteMatcher(name string) *labels.Matcher {
	return &labels.Matcher{
		Type:  labels.MatchEqual,
		Name:  NamedRouteMatcher,
		Value: name,
	}
}

type ManagedRoutes []*ManagedRoute

func (m ManagedRoutes) Sort() {
	// Sort the keys of the map to ensure consistent ordering. Always ensure that the default routing tree is last.
	slices.SortFunc(m, func(a, b *ManagedRoute) int {
		if models.IsDefaultRoutingTreeName(a.Name) {
			return 1
		}
		if models.IsDefaultRoutingTreeName(b.Name) {
			return -1
		}
		return strings.Compare(a.Name, b.Name)
	})
}

func (m ManagedRoutes) Contains(name string) bool {
	for _, r := range m {
		if r.Name == name {
			return true
		}
	}
	return false
}

func WithManagedRoutes(root *v1.Route, managedRoutes map[string]*v1.Route) *v1.Route {
	if len(managedRoutes) == 0 {
		// If there are no managed routes, we just return the original root.
		return root
	}
	newRoot := *root
	newManagedRoutes := make([]*v1.Route, 0, len(newRoot.Routes)+len(managedRoutes))
	for _, k := range slices.Sorted(maps.Keys(managedRoutes)) {
		// On the off chance that the route is nil or invalid managed route with the restricted name, we skip it.
		if managedRoutes[k] == nil || models.IsDefaultRoutingTreeName(k) {
			continue
		}
		newManagedRoutes = append(newManagedRoutes, NewManagedRoute(k, managedRoutes[k]).GeneratedSubRoute())
	}

	// Add the default routing tree at the end.
	newManagedRoutes = append(newManagedRoutes, newRoot.Routes...)
	newRoot.Routes = newManagedRoutes
	return &newRoot
}

func (rev *ConfigRevision) GetManagedRoute(name string) *ManagedRoute {
	if models.IsDefaultRoutingTreeName(name) {
		// Echo the requested name (canonical or alias) so the response preserves the name
		// the client used, while GetUID/ResourceID canonicalize for identity purposes.
		return NewManagedRoute(name, rev.Config.AlertmanagerConfig.Route)
	}
	route, ok := rev.Config.ManagedRoutes[name]
	if !ok {
		return nil
	}
	return NewManagedRoute(name, route)
}

func (rev *ConfigRevision) GetManagedRoutes(includeManagedRoutes bool) ManagedRoutes {
	managedRoutes := make(ManagedRoutes, 0, len(rev.Config.ManagedRoutes)+1)
	if includeManagedRoutes {
		for _, k := range slices.Sorted(maps.Keys(rev.Config.ManagedRoutes)) {
			// On the off chance that the route is nil or invalid managed route with the restricted name, we skip it.
			if rev.Config.ManagedRoutes[k] == nil || models.IsDefaultRoutingTreeName(k) {
				continue
			}
			managedRoutes = append(managedRoutes, NewManagedRoute(k, rev.Config.ManagedRoutes[k]))
		}
	}
	managedRoutes = append(managedRoutes, NewManagedRoute(models.DefaultRoutingTreeName, rev.Config.AlertmanagerConfig.Route))

	return managedRoutes
}

func (rev *ConfigRevision) DeleteManagedRoute(name string) {
	delete(rev.Config.ManagedRoutes, name)
}

// validateManagedRouteName validates that a managed route name is non-empty, does not contain ':', and is a valid DNS1123 subdomain.
func validateManagedRouteName(name string) error {
	if name = strings.TrimSpace(name); name == "" {
		return fmt.Errorf("route name is required")
	}
	// Colon in names confuses RBAC. Make sure we do not allow that.
	if strings.Contains(name, ":") {
		return fmt.Errorf("managed route name cannot contain invalid character ':'")
	}
	if len(name) > ualert.UIDMaxLength {
		return fmt.Errorf("managed route name cannot be longer than %d characters", ualert.UIDMaxLength)
	}
	if errs := k8svalidation.IsDNS1123Subdomain(name); len(errs) > 0 {
		return fmt.Errorf("managed route name must be a valid DNS subdomain: %s", strings.Join(errs, ", "))
	}
	return nil
}

func (rev *ConfigRevision) CreateManagedRoute(name string, subtree v1.Route) (*ManagedRoute, error) {
	if err := validateManagedRouteName(name); err != nil {
		return nil, models.MakeErrRouteInvalidFormat(err)
	}

	if models.IsDefaultRoutingTreeName(name) {
		return nil, models.ErrRouteExists.Errorf("cannot create a managed route with the name %q, this name is reserved for the default routing tree", name)
	}

	if _, exists := rev.Config.ManagedRoutes[name]; exists {
		return nil, models.ErrRouteExists.Errorf("")
	}

	managedRoute := NewManagedRoute(name, &subtree)
	amRoute := ManagedRouteToRoute(managedRoute)

	err := rev.ValidateRoute(amRoute)
	if err != nil {
		return nil, models.MakeErrRouteInvalidFormat(err)
	}

	if rev.Config.ManagedRoutes == nil {
		rev.Config.ManagedRoutes = make(map[string]*v1.Route, 1)
	}
	rev.Config.ManagedRoutes[name] = &amRoute

	return managedRoute, nil
}

func (rev *ConfigRevision) UpdateNamedRoute(name string, subtree v1.Route) (*ManagedRoute, error) {
	if name == "" {
		return nil, fmt.Errorf("route name is required")
	}

	if existing := rev.GetManagedRoute(name); existing == nil {
		return nil, fmt.Errorf("managed route %q not found", name)
	}

	managedRoute := NewManagedRoute(name, &subtree)
	amRoute := ManagedRouteToRoute(managedRoute)

	err := rev.ValidateRoute(amRoute)
	if err != nil {
		return nil, models.MakeErrRouteInvalidFormat(err)
	}

	if models.IsDefaultRoutingTreeName(name) {
		rev.Config.AlertmanagerConfig.Route = &amRoute
	} else {
		if rev.Config.ManagedRoutes == nil {
			rev.Config.ManagedRoutes = make(map[string]*v1.Route, 1)
		}
		rev.Config.ManagedRoutes[name] = &amRoute
	}

	return managedRoute, nil
}

func (rev *ConfigRevision) ResetUserDefinedRoute(defaultCfg *v1.AMConfigV1) (*ManagedRoute, error) {
	// Ensure the new default receiver exists and if not, create it.
	if err := rev.validateReceiverReferences(*defaultCfg.AlertmanagerConfig.Route); err != nil {
		// Default receiver doesn't exist, create it.
		var defaultRcv *v1.PostableApiReceiver
		for _, rcv := range defaultCfg.AlertmanagerConfig.Receivers {
			if rcv.Name == defaultCfg.AlertmanagerConfig.Route.Receiver {
				defaultRcv = rcv
				break
			}
		}
		if defaultRcv == nil {
			return nil, fmt.Errorf("inconsistent default configuration: default receiver %q not found", defaultCfg.AlertmanagerConfig.Route.Receiver)
		}
		rev.Config.AlertmanagerConfig.Receivers = append(rev.Config.AlertmanagerConfig.Receivers, defaultRcv)
	}

	return rev.UpdateNamedRoute(models.DefaultRoutingTreeName, *defaultCfg.AlertmanagerConfig.Route)
}

func (rev *ConfigRevision) ValidateRoute(route v1.Route) error {
	err := route.Validate()
	if err != nil {
		return err
	}

	err = rev.validateReceiverReferences(route)
	if err != nil {
		return err
	}

	err = rev.validateTimeIntervalReferences(route)
	if err != nil {
		return err
	}
	return nil
}

func (rev *ConfigRevision) validateReceiverReferences(route v1.Route) error {
	receivers := rev.GetReceiversNames()
	receivers[""] = struct{}{} // Allow empty receiver (inheriting from parent)
	return route.ValidateReceivers(receivers)
}

func (rev *ConfigRevision) validateTimeIntervalReferences(route v1.Route) error {
	timeIntervals := map[string]struct{}{}
	for _, mt := range rev.Config.AlertmanagerConfig.MuteTimeIntervals {
		timeIntervals[mt.Name] = struct{}{}
	}
	for _, mt := range rev.Config.AlertmanagerConfig.TimeIntervals {
		timeIntervals[mt.Name] = struct{}{}
	}
	return route.ValidateTimeIntervals(timeIntervals)
}

// RenameReceiverInRoutes renames all references to a receiver in all routes. Returns number of routes that were updated
func (rev *ConfigRevision) RenameReceiverInRoutes(oldName, newName string, includeManagedRoutes bool) map[*v1.Route]int {
	res := make(map[*v1.Route]int)
	if cnt := renameReceiverInRoute(oldName, newName, rev.Config.AlertmanagerConfig.Route); cnt > 0 {
		res[rev.Config.AlertmanagerConfig.Route] = cnt
	}
	for _, r := range rev.Config.ManagedRoutes {
		// Still attempt to rename receivers in any managed routes if not supported for data consistency, but
		// don't return them int he results.
		if cnt := renameReceiverInRoute(oldName, newName, r); includeManagedRoutes && cnt > 0 {
			res[r] = cnt
		}
	}
	return res
}

func renameReceiverInRoute(oldName, newName string, routes ...*v1.Route) int {
	if len(routes) == 0 {
		return 0
	}
	updated := 0
	for _, route := range routes {
		if route.Receiver == oldName {
			route.Receiver = newName
			updated++
		}
		updated += renameReceiverInRoute(oldName, newName, route.Routes...)
	}
	return updated
}

// RenameTimeIntervalInRoutes renames all references to a time interval in all routes. Returns number of routes that were updated
func (rev *ConfigRevision) RenameTimeIntervalInRoutes(oldName, newName string, includeManagedRoutes bool) map[*v1.Route]int {
	res := make(map[*v1.Route]int)
	if cnt := renameTimeIntervalInRoute(oldName, newName, rev.Config.AlertmanagerConfig.Route); cnt > 0 {
		res[rev.Config.AlertmanagerConfig.Route] = cnt
	}
	for _, r := range rev.Config.ManagedRoutes {
		// Still attempt to rename time intervals in any managed routes if not supported for data consistency, but
		// don't return them int he results.
		if cnt := renameTimeIntervalInRoute(oldName, newName, r); includeManagedRoutes && cnt > 0 {
			res[r] = cnt
		}
	}
	return res
}

func renameTimeIntervalInRoute(oldName, newName string, routes ...*v1.Route) int {
	if len(routes) == 0 {
		return 0
	}
	updated := 0
	for _, route := range routes {
		for idx := range route.MuteTimeIntervals {
			if route.MuteTimeIntervals[idx] == oldName {
				route.MuteTimeIntervals[idx] = newName
				updated++
			}
		}
		for idx := range route.ActiveTimeIntervals {
			if route.ActiveTimeIntervals[idx] == oldName {
				route.ActiveTimeIntervals[idx] = newName
				updated++
			}
		}
		updated += renameTimeIntervalInRoute(oldName, newName, route.Routes...)
	}
	return updated
}

func CalculateRouteFingerprint(route v1.Route) string {
	sum := fnv.New64a()
	writeToHash(sum, &route)
	return fmt.Sprintf("%016x", sum.Sum64())
}

func writeToHash(sum hash.Hash, r *v1.Route) {
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
