package receiver

import (
	"encoding/json"
	"fmt"

	"github.com/prometheus/alertmanager/config"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	model "github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

func getUID(t definitions.GettableApiReceiver) string {
	return legacy_storage.NameToUid(t.Name)
}

func convertToK8sResources(orgID int64, receivers []definitions.GettableApiReceiver, namespacer request.NamespaceMapper) (*model.ReceiverList, error) {
	result := &model.ReceiverList{
		Items: make([]model.Receiver, 0, len(receivers)),
	}
	for _, receiver := range receivers {
		k8sResource, err := convertToK8sResource(orgID, receiver, namespacer)
		if err != nil {
			return nil, err
		}
		result.Items = append(result.Items, *k8sResource)
	}
	return result, nil
}

func convertToK8sResource(orgID int64, receiver definitions.GettableApiReceiver, namespacer request.NamespaceMapper) (*model.Receiver, error) {
	spec := model.ReceiverSpec{
		Title: receiver.Receiver.Name,
	}
	provenance := definitions.Provenance(models.ProvenanceNone)
	for _, integration := range receiver.GrafanaManagedReceivers {
		if integration.Provenance != receiver.GrafanaManagedReceivers[0].Provenance {
			return nil, fmt.Errorf("all integrations must have the same provenance")
		}
		provenance = integration.Provenance
		unstruct := common.Unstructured{}
		err := json.Unmarshal(integration.Settings, &unstruct)
		if err != nil {
			return nil, fmt.Errorf("integration '%s' of receiver '%s' has settings that cannot be parsed as JSON: %w", integration.Type, receiver.Name, err)
		}
		spec.Integrations = append(spec.Integrations, model.Integration{
			Uid:                   &integration.UID,
			Type:                  integration.Type,
			DisableResolveMessage: &integration.DisableResolveMessage,
			Settings:              unstruct,
			SecureFields:          integration.SecureFields,
		})
	}

	uid := getUID(receiver) // TODO replace to stable UID when we switch to normal storage
	r := &model.Receiver{
		TypeMeta: resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			UID:             types.UID(uid), // This is needed to make PATCH work
			Name:            uid,            // TODO replace to stable UID when we switch to normal storage
			Namespace:       namespacer(orgID),
			ResourceVersion: "", // TODO: Implement optimistic concurrency.
		},
		Spec: spec,
	}
	r.SetProvenanceStatus(string(provenance))
	return r, nil
}

func convertToDomainModel(receiver *model.Receiver) (definitions.GettableApiReceiver, error) {
	// TODO: Using GettableApiReceiver instead of PostableApiReceiver so that SecureFields type matches.
	gettable := definitions.GettableApiReceiver{
		Receiver: config.Receiver{
			Name: receiver.Spec.Title,
		},
		GettableGrafanaReceivers: definitions.GettableGrafanaReceivers{
			GrafanaManagedReceivers: []*definitions.GettableGrafanaReceiver{},
		},
	}

	for _, integration := range receiver.Spec.Integrations {
		data, err := integration.Settings.MarshalJSON()
		if err != nil {
			return definitions.GettableApiReceiver{}, fmt.Errorf("integration '%s' of receiver '%s' is invalid: failed to convert unstructured data to bytes: %w", integration.Type, receiver.Name, err)
		}
		grafanaIntegration := definitions.GettableGrafanaReceiver{
			Name:         receiver.Spec.Title,
			Type:         integration.Type,
			Settings:     definitions.RawMessage(data),
			SecureFields: integration.SecureFields,
			Provenance:   definitions.Provenance(models.ProvenanceNone),
		}
		if integration.Uid != nil {
			grafanaIntegration.UID = *integration.Uid
		}
		if integration.DisableResolveMessage != nil {
			grafanaIntegration.DisableResolveMessage = *integration.DisableResolveMessage
		}
		gettable.GettableGrafanaReceivers.GrafanaManagedReceivers = append(gettable.GettableGrafanaReceivers.GrafanaManagedReceivers, &grafanaIntegration)
	}

	return gettable, nil
}
