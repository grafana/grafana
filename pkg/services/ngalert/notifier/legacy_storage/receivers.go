package legacy_storage

import (
	"fmt"
	"slices"

	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

type Provenances map[string]models.Provenance

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

	if err := rev.ValidateReceiver(postable); err != nil {
		return nil, err
	}

	return PostableApiReceiverToReceiver(postable, receiver.Provenance)
}

func (rev *ConfigRevision) UpdateReceiver(receiver *models.Receiver) (*models.Receiver, error) {
	var existingIdx = -1
	for idx, postable := range rev.Config.AlertmanagerConfig.Receivers {
		if NameToUid(postable.GetName()) == receiver.GetUID() {
			existingIdx = idx
			break
		}
	}
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

	if err := rev.ValidateReceiver(newReceiver); err != nil {
		return nil, err
	}

	return PostableApiReceiverToReceiver(newReceiver, receiver.Provenance)
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

func (rev *ConfigRevision) GetReceiver(uid string, prov Provenances) (*models.Receiver, error) {
	result, err := rev.GetReceivers([]string{uid}, prov)
	if err != nil {
		return nil, err
	}
	if len(result) > 0 {
		return result[0], nil
	}
	return nil, ErrReceiverNotFound.Errorf("")
}

func (rev *ConfigRevision) GetReceivers(uids []string, prov Provenances) ([]*models.Receiver, error) {
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
		recv, err := PostableApiReceiverToReceiver(r, GetReceiverProvenance(prov, r))
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

func DecryptedReceivers(receivers []*definitions.PostableApiReceiver, decryptFn models.DecryptFn) ([]*definitions.PostableApiReceiver, error) {
	decrypted := make([]*definitions.PostableApiReceiver, len(receivers))
	for i, r := range receivers {
		// We don't care about the provenance here, so we pass ProvenanceNone.
		rcv, err := PostableApiReceiverToReceiver(r, models.ProvenanceNone)
		if err != nil {
			return nil, err
		}

		err = rcv.Decrypt(decryptFn)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt receiver %q: %w", rcv.Name, err)
		}

		postable, err := ReceiverToPostableApiReceiver(rcv)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Receiver %q to APIReceiver: %w", rcv.Name, err)
		}
		decrypted[i] = postable
	}
	return decrypted, nil
}

func EncryptedReceivers(receivers []*definitions.PostableApiReceiver, encryptFn models.EncryptFn) ([]*definitions.PostableApiReceiver, error) {
	encrypted := make([]*definitions.PostableApiReceiver, len(receivers))
	for i, r := range receivers {
		// We don't care about the provenance here, so we pass ProvenanceNone.
		rcv, err := PostableApiReceiverToReceiver(r, models.ProvenanceNone)
		if err != nil {
			return nil, err
		}

		err = rcv.Encrypt(encryptFn)
		if err != nil {
			return nil, fmt.Errorf("failed to decrypt receiver %q: %w", rcv.Name, err)
		}

		postable, err := ReceiverToPostableApiReceiver(rcv)
		if err != nil {
			return nil, fmt.Errorf("failed to convert Receiver %q to APIReceiver: %w", rcv.Name, err)
		}
		encrypted[i] = postable
	}
	return encrypted, nil
}

// RenameReceiverInRoutes renames all references to a receiver in routes. Returns number of routes that were updated
func (rev *ConfigRevision) RenameReceiverInRoutes(oldName, newName string) int {
	return RenameReceiverInRoute(oldName, newName, rev.Config.AlertmanagerConfig.Route)
}

// ValidateReceiver checks if the given receiver conflicts in name or integration UID with existing receivers.
// We only check the receiver being modified to prevent existing issues from other receivers being reported.
func (rev *ConfigRevision) ValidateReceiver(p *definitions.PostableApiReceiver) error {
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

func RenameReceiverInRoute(oldName, newName string, routes ...*definitions.Route) int {
	if len(routes) == 0 {
		return 0
	}
	updated := 0
	for _, route := range routes {
		if route.Receiver == oldName {
			route.Receiver = newName
			updated++
		}
		updated += RenameReceiverInRoute(oldName, newName, route.Routes...)
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
