package legacy_storage

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
)

type ReceiverStore struct {
	provisioningStore provisoningStore
	cfgStore          *alertmanagerConfigStoreImpl
	xact              transactionManager
	validator         validation.ProvenanceStatusTransitionValidator
}

type provisoningStore interface {
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
	DeleteProvenance(ctx context.Context, o models.Provisionable, org int64) error
}

type transactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

func NewReceiverStore(
	cfgStore amConfigStore,
	provisioningStore provisoningStore,
	xact transactionManager,
	validator validation.ProvenanceStatusTransitionValidator,
) *ReceiverStore {
	return &ReceiverStore{
		provisioningStore: provisioningStore,
		cfgStore:          NewAlertmanagerConfigStore(cfgStore),
		xact:              xact,
		validator:         validator,
	}
}

func (rs *ReceiverStore) GetReceiver(ctx context.Context, orgID int64, uid string) (*models.Receiver, error) {
	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}
	return rs.getReceiverFromConfig(ctx, orgID, revision.Config, uid)
}

func (rs *ReceiverStore) GetReceivers(ctx context.Context, orgID int64, uids ...string) ([]*models.Receiver, error) {
	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	return rs.getReceiversFromConfig(ctx, orgID, revision.Config, uids)
}

func (rs *ReceiverStore) DeleteReceiver(ctx context.Context, orgID int64, uid string, callerProvenance models.Provenance, version string) error {
	revision, err := rs.cfgStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	rcv, err := rs.getReceiverFromConfig(ctx, orgID, revision.Config, uid)
	if err != nil {
		return err
	}

	// TODO: Implement + check optimistic concurrency.

	if err := rs.validator(rcv.Provenance, callerProvenance); err != nil {
		return err
	}

	if rcv.InUseByRoute || rcv.InUseByRule {
		return ErrReceiverInUse.Errorf("")
	}

	// Remove the receiver from the configuration.
	revision.Config.AlertmanagerConfig.Receivers = slices.DeleteFunc(revision.Config.AlertmanagerConfig.Receivers, func(r *definitions.PostableApiReceiver) bool {
		return models.GetUIDFromNamed(r) == uid
	})

	return rs.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = rs.cfgStore.Save(ctx, revision, orgID)
		if err != nil {
			return err
		}

		// Remove provenance for all integrations in the receiver.
		for _, integration := range rcv.Integrations {
			target := definitions.EmbeddedContactPoint{UID: integration.UID}
			if err := rs.provisioningStore.DeleteProvenance(ctx, &target, orgID); err != nil {
				return err
			}
		}
		return nil
	})
}

func (rs *ReceiverStore) getReceiverFromConfig(ctx context.Context, orgID int64, cfg *definitions.PostableUserConfig, uid string) (*models.Receiver, error) {
	receivers, err := rs.getReceiversFromConfig(ctx, orgID, cfg, []string{uid})
	if err != nil {
		return nil, err
	}
	if len(receivers) == 0 {
		return nil, ErrReceiverNotFound.Errorf("")
	}
	if len(receivers) > 1 {
		return nil, fmt.Errorf("expected one receiver, got %d", len(receivers))
	}
	return receivers[0], nil
}

func (rs *ReceiverStore) getReceiversFromConfig(ctx context.Context, orgID int64, cfg *definitions.PostableUserConfig, uids []string) ([]*models.Receiver, error) {
	storedProvenances, err := rs.provisioningStore.GetProvenances(ctx, orgID, (&definitions.EmbeddedContactPoint{}).ResourceType())
	if err != nil {
		return nil, err
	}

	receivers := make([]*models.Receiver, 0, len(uids))
	for _, r := range cfg.AlertmanagerConfig.Receivers {
		if len(uids) == 0 || slices.Contains(uids, models.GetUIDFromNamed(r)) {
			provenance, err := getContactPointProvenance(storedProvenances, r)
			if err != nil {
				return nil, err
			}
			receivers = append(receivers, &models.Receiver{
				Name:         r.Receiver.Name,
				Integrations: PostableApiReceiverToGrafanaIntegrationConfigs(r),
				Provenance:   provenance,
				InUseByRoute: isReceiverInUse(r.Receiver.Name, []*definitions.Route{cfg.AlertmanagerConfig.Route}),
				InUseByRule:  false, // TODO: Implement.
			})
		}
	}
	return receivers, nil
}

// getContactPointProvenance determines the provenance of a definitions.PostableApiReceiver based on the provenance of its integrations.
func getContactPointProvenance(storedProvenances map[string]models.Provenance, r *definitions.PostableApiReceiver) (models.Provenance, error) {
	if len(r.GrafanaManagedReceivers) == 0 {
		return models.ProvenanceNone, nil
	}

	// Current provisioning works on the integration level, so we need some way to determine the provenance of the
	// entire receiver. All integrations in a receiver should have the same provenance, but we don't want to rely on
	// this assumption in case the first provenance is None and a later one is not. To this end, we return the first
	// non-zero provenance we find.
	for _, contactPoint := range r.GrafanaManagedReceivers {
		if p, exists := storedProvenances[contactPoint.UID]; exists && p != models.ProvenanceNone {
			return p, nil
		}
	}
	return models.ProvenanceNone, nil
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
