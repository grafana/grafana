package v1

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
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type ManagedRoute struct {
	ResourceMetadata

	Receiver       string
	GroupBy        []string
	GroupWait      *model.Duration
	GroupInterval  *model.Duration
	RepeatInterval *model.Duration
	Routes         []*Route

	Origin models.ResourceOrigin
}

func (r *ManagedRoute) GetUID() string {
	return string(r.UID)
}

func (r *ManagedRoute) ResourceType() string {
	return (&definition.Route{}).ResourceType()
}

func (r *ManagedRoute) ResourceID() string {
	if models.IsDefaultRoutingTreeName(r.GetUID()) {
		// Backwards compatibility with the legacy default (root) routing tree.
		return ""
	}
	return r.GetUID()
}

// RouteUID derives a route's stable identity from its name, canonicalizing the default tree's
// legacy alias so both spellings resolve to the same identity. Unlike other resource UIDs, this
// is not hashed: it is used verbatim as an RBAC scope suffix and provenance-store key, so it must
// keep producing the same value it always has.
func RouteUID(name string) ResourceUID {
	return ResourceUID(models.CanonicalizeRoutingTreeName(name))
}

func NewManagedRoute(name string, r *Route) *ManagedRoute {
	return &ManagedRoute{
		ResourceMetadata: ResourceMetadata{
			UID:        RouteUID(name),
			Version:    CalculateRouteFingerprint(*r),
			Provenance: models.Provenance(r.Provenance),
		},

		Receiver:       r.Receiver,
		GroupBy:        r.GroupByStr,
		GroupWait:      r.GroupWait,
		GroupInterval:  r.GroupInterval,
		RepeatInterval: r.RepeatInterval,
		Routes:         r.Routes,

		Origin: models.ResourceOriginGrafana,
	}
}

type ManagedRoutes []*ManagedRoute

func (m ManagedRoutes) Sort() {
	// Sort the keys of the map to ensure consistent ordering. Always ensure that the default routing tree is last.
	slices.SortFunc(m, func(a, b *ManagedRoute) int {
		if models.IsDefaultRoutingTreeName(a.GetUID()) {
			return 1
		}
		if models.IsDefaultRoutingTreeName(b.GetUID()) {
			return -1
		}
		return strings.Compare(a.GetUID(), b.GetUID())
	})
}

func (m ManagedRoutes) Contains(uid string) bool {
	for _, r := range m {
		if r.GetUID() == uid {
			return true
		}
	}
	return false
}

func CalculateRouteFingerprint(route Route) string {
	sum := fnv.New64a()
	writeToHash(sum, &route)
	return fmt.Sprintf("%016x", sum.Sum64())
}

func writeToHash(sum hash.Hash, r *Route) {
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
		// avoid allocation when converting string to byte slice
		writeBytes(unsafe.Slice(unsafe.StringData(s), len(s))) // #nosec G103 nosemgrep: go.lang.security.audit.unsafe.use-of-unsafe-block
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
