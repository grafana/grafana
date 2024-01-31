package notifier

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"slices"

	"github.com/grafana/alerting/notify"

	"github.com/prometheus/alertmanager/config"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/secrets"
)

var (
	// TODO: convert to errutil
	ErrPermissionDenied = errors.New("permission denied")
)

type ReceiverService struct {
	ac                 accesscontrol.AccessControl
	provisioningStore  provisoningStore
	versionedConfStore *LockingConfigStore
	encryptionService  secrets.Service
	xact               TransactionManager
	log                log.Logger
}

type provisoningStore interface {
	GetProvenances(ctx context.Context, org int64, resourceType string) (map[string]models.Provenance, error)
}

type TransactionManager interface {
	InTransaction(ctx context.Context, work func(ctx context.Context) error) error
}

func NewReceiverService(
	ac accesscontrol.AccessControl,
	configStore configStore,
	provisioningStore provisoningStore,
	encryptionService secrets.Service,
	xact TransactionManager,
	log log.Logger,
) *ReceiverService {
	return &ReceiverService{
		ac:                 ac,
		provisioningStore:  provisioningStore,
		versionedConfStore: &LockingConfigStore{Store: configStore},
		encryptionService:  encryptionService,
		xact:               xact,
		log:                log,
	}
}

func (rs *ReceiverService) canDecrypt(ctx context.Context, user identity.Requester, name string) (bool, error) {
	receiverAccess := false // TODO: stub, check for read secrets access
	eval := accesscontrol.EvalPermission(accesscontrol.ActionAlertingProvisioningReadSecrets)
	provisioningAccess, err := rs.ac.Evaluate(ctx, user, eval)
	if err != nil {
		return false, err
	}
	return receiverAccess || provisioningAccess, nil
}

func (rs *ReceiverService) GetReceivers(ctx context.Context, q models.GetReceiversQuery, user identity.Requester) ([]definitions.GettableApiReceiver, error) {
	rev, err := rs.versionedConfStore.GetLockingConfig(ctx, q.OrgID)
	if err != nil {
		return nil, err
	}

	provenances, err := rs.provisioningStore.GetProvenances(ctx, q.OrgID, "contactPoint")
	if err != nil {
		return nil, err
	}

	// TODO: check for list access

	var output []definitions.GettableApiReceiver
	for i := q.Offset; i < len(rev.Config.AlertmanagerConfig.Receivers); i++ {
		r := rev.Config.AlertmanagerConfig.Receivers[i]
		if len(q.Names) > 0 && !slices.Contains(q.Names, r.Name) {
			continue
		}

		// TODO: check for scoped read access and continue if not allowed

		decryptAccess, err := rs.canDecrypt(ctx, user, r.Name)
		if err != nil {
			return nil, err
		}
		if q.Decrypt && !decryptAccess {
			return nil, ErrPermissionDenied
		}

		decryptFn := func(uid string) func(v string) string {
			return rs.decryptOrRedact(ctx, uid, decryptAccess && q.Decrypt)
		}

		res, err := rs.postableToGettableApiReceiver(r, provenances, decryptFn)
		if err != nil {
			return nil, err
		}

		// TODO: redact settings if the user only has list access

		output = append(output, res)
		// stop if we have reached the limit or we have found all the requested receivers
		if (len(output) == q.Limit && q.Limit > 0) || (len(output) == len(q.Names)) {
			break
		}
	}

	return output, nil
}

func (rs *ReceiverService) postableToGettableApiReceiver(r *definitions.PostableApiReceiver, provenances map[string]models.Provenance, decryptFn func(uid string) func(v string) string) (definitions.GettableApiReceiver, error) {
	out := definitions.GettableApiReceiver{
		Receiver: config.Receiver{
			Name: r.Receiver.Name,
		},
	}

	for _, gr := range r.GrafanaManagedReceivers {
		var prov *models.Provenance
		if p, ok := provenances[gr.UID]; ok {
			prov = &p
		}

		gettable, err := rs.postableToGettableGrafanaReceiver(gr, prov, decryptFn(gr.UID))
		if err != nil {
			return definitions.GettableApiReceiver{}, err
		}
		out.GrafanaManagedReceivers = append(out.GrafanaManagedReceivers, &gettable)
	}

	return out, nil
}

func (rs *ReceiverService) postableToGettableGrafanaReceiver(r *definitions.PostableGrafanaReceiver, provenance *models.Provenance, decryptFn func(v string) string) (definitions.GettableGrafanaReceiver, error) {
	out := definitions.GettableGrafanaReceiver{
		UID:                   r.UID,
		Name:                  r.Name,
		Type:                  r.Type,
		DisableResolveMessage: r.DisableResolveMessage,
		SecureFields:          make(map[string]bool, len(r.SecureSettings)),
	}

	if provenance != nil {
		out.Provenance = definitions.Provenance(*provenance)
	}

	settings, err := simplejson.NewJson([]byte(r.Settings))
	if err != nil {
		return definitions.GettableGrafanaReceiver{}, err
	}

	for k, v := range r.SecureSettings {
		decryptedValue := decryptFn(v)
		if decryptedValue == "" {
			continue
		} else {
			settings.Set(k, decryptedValue)
		}
		out.SecureFields[k] = true
	}

	jsonBytes, err := settings.MarshalJSON()
	if err != nil {
		return definitions.GettableGrafanaReceiver{}, err
	}
	out.Settings = jsonBytes

	return out, nil
}

func (rs *ReceiverService) decryptOrRedact(ctx context.Context, uid string, decrypt bool) func(string) string {
	return func(val string) string {
		if !decrypt {
			return definitions.RedactedValue
		}

		decoded, err := base64.StdEncoding.DecodeString(val)
		if err != nil {
			rs.log.Warn("failed to decode secure setting", "uid", uid, "error", err)
			return ""
		}
		decrypted, err := rs.encryptionService.Decrypt(ctx, decoded)
		if err != nil {
			rs.log.Warn("failed to decrypt secure setting", "uid", uid, "error", err)
			return ""
		}
		return string(decrypted)
	}
}

func ValidateReceiver(ctx context.Context, r definitions.PostableGrafanaReceiver, decryptFn notify.GetDecryptedValueFn) error {
	if r.Type == "" {
		return errors.New("type is required")
	}
	if r.Settings == nil {
		return errors.New("settings are required")
	}

	integrationConfig := &notify.GrafanaIntegrationConfig{
		UID:                   r.UID,
		Name:                  r.Name,
		Type:                  r.Type,
		DisableResolveMessage: r.DisableResolveMessage,
		Settings:              json.RawMessage(r.Settings),
		SecureSettings:        r.SecureSettings,
	}

	_, err := notify.BuildReceiverConfiguration(ctx, &notify.APIReceiver{
		GrafanaIntegrations: notify.GrafanaIntegrations{
			Integrations: []*notify.GrafanaIntegrationConfig{integrationConfig},
		},
	}, decryptFn)
	return err
}
