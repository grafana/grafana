package legacy_storage

import (
	"encoding/binary"
	"fmt"
	"hash"
	"hash/fnv"
	"maps"
	"slices"
	"unsafe"

	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func (rev *ConfigRevision) ResetUserDefinedRoute(defaultCfg *definitions.PostableUserConfig) error {
	// Ensure the new default receiver exists and if not, create it.
	if err := rev.validateReceiverReferences(*defaultCfg.AlertmanagerConfig.Route); err != nil {
		// Default receiver doesn't exist, create it.
		var defaultRcv *definitions.PostableApiReceiver
		for _, rcv := range defaultCfg.AlertmanagerConfig.Receivers {
			if rcv.Name == defaultCfg.AlertmanagerConfig.Route.Receiver {
				defaultRcv = rcv
				break
			}
		}
		if defaultRcv == nil {
			return fmt.Errorf("inconsistent default configuration: default receiver %q not found", defaultCfg.AlertmanagerConfig.Route.Receiver)
		}
		rev.Config.AlertmanagerConfig.Receivers = append(rev.Config.AlertmanagerConfig.Receivers, defaultRcv)
	}

	rev.Config.AlertmanagerConfig.Route = defaultCfg.AlertmanagerConfig.Route
	return nil
}

func (rev *ConfigRevision) ValidateRoute(route definitions.Route) error {
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

func (rev *ConfigRevision) validateReceiverReferences(route definitions.Route) error {
	receivers := rev.GetReceiversNames()
	receivers[""] = struct{}{} // Allow empty receiver (inheriting from parent)
	return route.ValidateReceivers(receivers)
}

func (rev *ConfigRevision) validateTimeIntervalReferences(route definitions.Route) error {
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
func (rev *ConfigRevision) RenameReceiverInRoutes(oldName, newName string) int {
	return renameReceiverInRoute(oldName, newName, rev.Config.AlertmanagerConfig.Route)
}

func renameReceiverInRoute(oldName, newName string, routes ...*definitions.Route) int {
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
func (rev *ConfigRevision) RenameTimeIntervalInRoutes(oldName, newName string) int {
	return renameTimeIntervalInRoute(oldName, newName, rev.Config.AlertmanagerConfig.Route)
}

func renameTimeIntervalInRoute(oldName, newName string, routes ...*definitions.Route) int {
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

// ToGroupBy converts the given label strings to (groupByAll, []model.LabelName) where groupByAll is true if the input
// contains models.GroupByAll. This logic is in accordance with upstream Route.ValidateChild().
func ToGroupBy(groupByStr ...string) (groupByAll bool, groupBy []model.LabelName) {
	for _, l := range groupByStr {
		if l == models.GroupByAll {
			return true, nil
		} else {
			groupBy = append(groupBy, model.LabelName(l))
		}
	}
	return false, groupBy
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
