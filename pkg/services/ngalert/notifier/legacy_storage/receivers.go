package legacy_storage

import (
	"fmt"
	"slices"

	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

type provenances = map[string]models.Provenance

func (rev *ConfigRevision) DeleteReceiver(uid string) {
	// Remove the receiver from the configuration.
	rev.Config.AlertmanagerConfig.Receivers = slices.DeleteFunc(rev.Config.AlertmanagerConfig.Receivers, func(r *definitions.PostableApiReceiver) bool {
		return NameToUid(r.GetName()) == uid
	})
}

func (rev *ConfigRevision) CreateReceiver(receiver *models.Receiver) (*models.Receiver, error) {
	exists := slices.ContainsFunc(rev.Config.AlertmanagerConfig.Receivers, func(r *definition.PostableApiReceiver) bool {
		return NameToUid(r.Name) == receiver.GetUID()
	})
	if exists {
		return nil, ErrReceiverExists.Errorf("")
	}

	if err := validateAndSetIntegrationUIDs(receiver); err != nil {
		return nil, err
	}

	postable, err := ReceiverToPostableApiReceiver(receiver)
	if err != nil {
		return nil, err
	}

	rev.Config.AlertmanagerConfig.Receivers = append(rev.Config.AlertmanagerConfig.Receivers, postable)

	if err := rev.validateReceiver(postable); err != nil {
		return nil, err
	}

	return PostableApiReceiverToReceiver(postable, receiver.Provenance, models.ResourceOriginGrafana)
}

func (rev *ConfigRevision) UpdateReceiver(receiver *models.Receiver) (*models.Receiver, error) {
	existingIdx := slices.IndexFunc(rev.Config.AlertmanagerConfig.Receivers, func(postable *definitions.PostableApiReceiver) bool {
		return NameToUid(postable.GetName()) == receiver.GetUID()
	})
	if existingIdx < 0 {
		return nil, ErrReceiverNotFound.Errorf("")
	}

	if err := validateAndSetIntegrationUIDs(receiver); err != nil {
		return nil, err
	}

	newReceiver, err := ReceiverToPostableApiReceiver(receiver)
	if err != nil {
		return nil, err
	}

	rev.Config.AlertmanagerConfig.Receivers[existingIdx] = newReceiver

	if err := rev.validateReceiver(newReceiver); err != nil {
		return nil, err
	}

	return PostableApiReceiverToReceiver(newReceiver, receiver.Provenance, models.ResourceOriginGrafana)
}

// ReceiverNameUsedByRoutes checks if a receiver name is used in any routes.
func (rev *ConfigRevision) ReceiverNameUsedByRoutes(name string) bool {
	return isReceiverInUse(name, []*definitions.Route{rev.Config.AlertmanagerConfig.Route})
}

// ReceiverUseByName returns a map of receiver names to the number of times they are used in routes.
func (rev *ConfigRevision) ReceiverUseByName() map[string]int {
	m := make(map[string]int)
	receiverUseCounts([]*definitions.Route{rev.Config.AlertmanagerConfig.Route}, m)
	return m
}

func (rev *ConfigRevision) GetReceiver(uid string, prov provenances) (*models.Receiver, error) {
	for _, r := range rev.Config.AlertmanagerConfig.Receivers {
		if NameToUid(r.GetName()) != uid {
			continue
		}
		recv, err := PostableApiReceiverToReceiver(r, GetReceiverProvenance(prov, r, models.ResourceOriginGrafana), models.ResourceOriginGrafana)
		if err != nil {
			return nil, fmt.Errorf("failed to convert receiver %q: %w", r.Name, err)
		}
		return recv, nil
	}
	return nil, ErrReceiverNotFound.Errorf("")
}

func (rev *ConfigRevision) GetReceivers(uids []string, prov provenances) ([]*models.Receiver, error) {
	capacity := len(uids)
	if capacity == 0 {
		capacity = len(rev.Config.AlertmanagerConfig.Receivers)
	}
	receivers := make([]*models.Receiver, 0, capacity)
	for _, r := range rev.Config.AlertmanagerConfig.Receivers {
		uid := NameToUid(r.GetName())
		if len(uids) > 0 && !slices.Contains(uids, uid) {
			continue
		}
		recv, err := PostableApiReceiverToReceiver(r, GetReceiverProvenance(prov, r, models.ResourceOriginGrafana), models.ResourceOriginGrafana)
		if err != nil {
			return nil, fmt.Errorf("failed to convert receiver %q: %w", r.Name, err)
		}
		receivers = append(receivers, recv)
	}
	return receivers, nil
}

// GetReceiversNames returns a map of receiver names
func (rev *ConfigRevision) GetReceiversNames() map[string]struct{} {
	result := make(map[string]struct{}, len(rev.Config.AlertmanagerConfig.Receivers))
	for _, r := range rev.Config.AlertmanagerConfig.Receivers {
		result[r.GetName()] = struct{}{}
	}
	return result
}

// RenameReceiverInRoutes renames all references to a receiver in routes. Returns number of routes that were updated
func (rev *ConfigRevision) RenameReceiverInRoutes(oldName, newName string) int {
	return renameReceiverInRoute(oldName, newName, rev.Config.AlertmanagerConfig.Route)
}

// validateReceiver checks if the given receiver conflicts in name or integration UID with existing receivers.
// We only check the receiver being modified to prevent existing issues from other receivers being reported.
func (rev *ConfigRevision) validateReceiver(p *definitions.PostableApiReceiver) error {
	uids := make(map[string]struct{}, len(rev.Config.AlertmanagerConfig.Receivers))
	for _, integrations := range p.GrafanaManagedReceivers {
		if _, exists := uids[integrations.UID]; exists {
			return MakeErrReceiverInvalid(fmt.Errorf("integration with UID %q already exists", integrations.UID))
		}
		uids[integrations.UID] = struct{}{}
	}

	for _, r := range rev.Config.AlertmanagerConfig.Receivers {
		if p == r {
			// Skip the receiver itself.
			continue
		}
		if r.GetName() == p.GetName() {
			return MakeErrReceiverInvalid(fmt.Errorf("name %q already exists", r.GetName()))
		}

		for _, gr := range r.GrafanaManagedReceivers {
			if _, exists := uids[gr.UID]; exists {
				return MakeErrReceiverInvalid(fmt.Errorf("integration with UID %q already exists", gr.UID))
			}
		}
	}
	return nil
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

// receiverUseCounts counts how many times receivers are used in a route or any of its sub-routes.
func receiverUseCounts(routes []*definitions.Route, m map[string]int) {
	if len(routes) == 0 {
		return
	}
	for _, route := range routes {
		m[route.Receiver]++
		receiverUseCounts(route.Routes, m)
	}
}

// validateAndSetIntegrationUIDs validates existing integration UIDs and generates them if they are empty.
func validateAndSetIntegrationUIDs(receiver *models.Receiver) error {
	for _, integration := range receiver.Integrations {
		if integration.UID == "" {
			integration.UID = util.GenerateShortUID()
		} else if err := util.ValidateUID(integration.UID); err != nil {
			return MakeErrReceiverInvalid(fmt.Errorf("integration UID %q is invalid: %w", integration.UID, err))
		}
	}
	return nil
}
