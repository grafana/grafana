package legacy_storage

import (
	"slices"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func (rev *ConfigRevision) DeleteReceiver(uid string) {
	// Remove the receiver from the configuration.
	rev.Config.AlertmanagerConfig.Receivers = slices.DeleteFunc(rev.Config.AlertmanagerConfig.Receivers, func(r *definitions.PostableApiReceiver) bool {
		return NameToUid(r.GetName()) == uid
	})
}

func (rev *ConfigRevision) ReceiverNameUsedByRoutes(name string) bool {
	return isReceiverInUse(name, []*definitions.Route{rev.Config.AlertmanagerConfig.Route})
}

func (rev *ConfigRevision) GetReceiver(uid string) *definitions.PostableApiReceiver {
	for _, r := range rev.Config.AlertmanagerConfig.Receivers {
		if NameToUid(r.GetName()) == uid {
			return r
		}
	}
	return nil
}

func (rev *ConfigRevision) GetReceivers(uids []string) []*definitions.PostableApiReceiver {
	receivers := make([]*definitions.PostableApiReceiver, 0, len(uids))
	for _, r := range rev.Config.AlertmanagerConfig.Receivers {
		if len(uids) == 0 || slices.Contains(uids, NameToUid(r.GetName())) {
			receivers = append(receivers, r)
		}
	}
	return receivers
}

// isReceiverInUse checks if a receiver is used in a route or any of its sub-routes.
func isReceiverInUse(name string, routes []*definitions.Route) bool {
	if len(routes) == 0 {
		return false
	}
	for _, route := range routes {
		if route.Receiver == name {
			return true
		}
		if isReceiverInUse(name, route.Routes) {
			return true
		}
	}
	return false
}
