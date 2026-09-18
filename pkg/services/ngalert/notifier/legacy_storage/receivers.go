package legacy_storage

import (
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/util"
)

type provenances = map[string]models.Provenance

func (rev *ConfigRevision) DeleteReceiver(uid string) {
	// Remove the receiver from the configuration.
	delete(rev.Config.Receivers, v1.ResourceUID(uid))
}

func (rev *ConfigRevision) CreateReceiver(receiver *models.Receiver) (*models.Receiver, error) {
	if _, exists := rev.Config.Receivers[v1.ResourceUID(receiver.GetUID())]; exists {
		return nil, models.ErrReceiverExists.Errorf("")
	}

	if err := validateAndSetIntegrationUIDs(receiver); err != nil {
		return nil, err
	}

	if err := rev.validateReceiver(receiver); err != nil {
		return nil, err
	}

	return rev.setReceiver(receiver)
}

func (rev *ConfigRevision) UpdateReceiver(receiver *models.Receiver) (*models.Receiver, error) {
	if _, exists := rev.Config.Receivers[v1.ResourceUID(receiver.GetUID())]; !exists {
		return nil, models.ErrReceiverNotFound.Errorf("")
	}

	if err := validateAndSetIntegrationUIDs(receiver); err != nil {
		return nil, err
	}

	if err := rev.validateReceiver(receiver); err != nil {
		return nil, err
	}

	return rev.setReceiver(receiver)
}

func (rev *ConfigRevision) setReceiver(receiver *models.Receiver) (*models.Receiver, error) {
	postable, err := ReceiverToPostableApiReceiver(receiver)
	if err != nil {
		return nil, err
	}

	persistedRecv, err := PostableApiReceiverToReceiver(postable, receiver.Provenance, models.ResourceOriginGrafana)
	if err != nil {
		return nil, err
	}

	if rev.Config.Receivers == nil {
		rev.Config.Receivers = make(map[v1.ResourceUID]v1.PostableApiReceiver, 1)
	}
	rev.Config.Receivers[v1.ResourceUID(persistedRecv.UID)] = *postable

	if persistedRecv.UID != receiver.UID {
		// Since the UID is currently derived from the name, a rename must move the entry to a new key rather than trusting
		// the caller's (now-stale) UID.
		delete(rev.Config.Receivers, v1.ResourceUID(receiver.UID))
	}

	return persistedRecv, nil
}

// ReceiverNameUsedByRoutes checks if a receiver name is used in any routes.
func (rev *ConfigRevision) ReceiverNameUsedByRoutes(name string) bool {
	if isReceiverInUse(name, []*v1.Route{rev.Config.AlertmanagerConfig.Route}) {
		return true
	}
	for _, r := range rev.Config.ManagedRoutes {
		if isReceiverInUse(name, []*v1.Route{r}) {
			return true
		}
	}
	return false
}

// ReceiverUseByName returns a map of receiver names to the number of times they are used in routes.
func (rev *ConfigRevision) ReceiverUseByName() map[string]int {
	m := make(map[string]int)
	receiverUseCounts([]*v1.Route{rev.Config.AlertmanagerConfig.Route}, m)
	for _, r := range rev.Config.ManagedRoutes {
		receiverUseCounts([]*v1.Route{r}, m)
	}
	return m
}

func (rev *ConfigRevision) GetReceiver(uid string, prov provenances) (*models.Receiver, error) {
	r, ok := rev.Config.Receivers[v1.ResourceUID(uid)]
	if !ok {
		return nil, models.ErrReceiverNotFound.Errorf("")
	}
	recv, err := PostableApiReceiverToReceiver(&r, GetReceiverProvenance(prov, &r, models.ResourceOriginGrafana), models.ResourceOriginGrafana)
	if err != nil {
		return nil, fmt.Errorf("failed to convert receiver %q: %w", r.Name, err)
	}
	return recv, nil
}

func (rev *ConfigRevision) GetReceivers(uids []string, prov provenances) ([]*models.Receiver, error) {
	capacity := len(uids)
	if capacity == 0 {
		capacity = len(rev.Config.Receivers)
	}
	receivers := make([]*models.Receiver, 0, capacity)
	for _, r := range rev.Config.GetReceivers() {
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
	result := make(map[string]struct{}, len(rev.Config.Receivers))
	for _, r := range rev.Config.Receivers {
		result[r.GetName()] = struct{}{}
	}
	return result
}

// validateReceiver checks if the given receiver conflicts in name or integration UID with existing receivers.
// We only check the receiver being modified to prevent existing issues from other receivers being reported.
func (rev *ConfigRevision) validateReceiver(p *models.Receiver) error {
	uids := make(map[string]struct{}, len(p.Integrations))
	for _, integrations := range p.Integrations {
		if _, exists := uids[integrations.UID]; exists {
			return models.ErrReceiverInvalid(fmt.Errorf("integration with UID %q already exists", integrations.UID))
		}
		uids[integrations.UID] = struct{}{}
	}

	for existingUID, r := range rev.Config.Receivers {
		if existingUID == v1.ResourceUID(p.UID) {
			// Skip the receiver being created/updated.
			continue
		}
		if r.GetName() == p.Name {
			return models.ErrReceiverInvalid(fmt.Errorf("name %q already exists", r.GetName()))
		}

		for _, gr := range r.GrafanaManagedReceivers {
			if _, exists := uids[gr.UID]; exists {
				return models.ErrReceiverInvalid(fmt.Errorf("integration with UID %q already exists", gr.UID))
			}
		}
	}
	return nil
}

// isReceiverInUse checks if a receiver is used in a route or any of its sub-routes.
func isReceiverInUse(name string, routes []*v1.Route) bool {
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
func receiverUseCounts(routes []*v1.Route, m map[string]int) {
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
			return models.ErrReceiverInvalid(fmt.Errorf("integration UID %q is invalid: %w", integration.UID, err))
		}
	}
	return nil
}
