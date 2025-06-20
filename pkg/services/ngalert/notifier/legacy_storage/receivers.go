package legacy_storage

import (
	"errors"
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func (rev *ConfigRevision) DeleteReceiver(uid string) {
	// Remove the receiver from the configuration.
	rev.Config.AlertmanagerConfig.Receivers = slices.DeleteFunc(rev.Config.AlertmanagerConfig.Receivers, func(r *definitions.PostableApiReceiver) bool {
		return NameToUid(r.GetName()) == uid
	})
}

func (rev *ConfigRevision) CreateReceiver(receiver *models.Receiver) (*definitions.PostableApiReceiver, error) {
	// Check if the receiver already exists.
	_, err := rev.GetReceiver(receiver.GetUID())
	if err == nil {
		return nil, ErrReceiverExists.Errorf("")
	}
	if !errors.Is(err, ErrReceiverNotFound) {
		return nil, err
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

	return postable, nil
}

func (rev *ConfigRevision) UpdateReceiver(receiver *models.Receiver) (*definitions.PostableApiReceiver, error) {
	existing, err := rev.GetReceiver(receiver.GetUID())
	if err != nil {
		return nil, err
	}

	if err := validateAndSetIntegrationUIDs(receiver); err != nil {
		return nil, err
	}

	postable, err := ReceiverToPostableApiReceiver(receiver)
	if err != nil {
		return nil, err
	}

	// Update receiver in the configuration.
	*existing = *postable

	if err := rev.ValidateReceiver(existing); err != nil {
		return nil, err
	}

	return postable, nil
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

func (rev *ConfigRevision) GetReceiver(uid string) (*definitions.PostableApiReceiver, error) {
	for _, r := range rev.Config.AlertmanagerConfig.Receivers {
		if NameToUid(r.GetName()) == uid {
			return r, nil
		}
	}
	return nil, ErrReceiverNotFound.Errorf("")
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
