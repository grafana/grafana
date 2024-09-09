package receiver

import (
	"maps"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	model "github.com/grafana/grafana/pkg/apis/alerting_notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

func convertToK8sResources(orgID int64, receivers []*ngmodels.Receiver, namespacer request.NamespaceMapper) (*model.ReceiverList, error) {
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

func convertToK8sResource(orgID int64, receiver *ngmodels.Receiver, namespacer request.NamespaceMapper) (*model.Receiver, error) {
	spec := model.ReceiverSpec{
		Title: receiver.Name,
	}
	for _, integration := range receiver.Integrations {
		spec.Integrations = append(spec.Integrations, model.Integration{
			Uid:                   &integration.UID,
			Type:                  integration.Config.Type,
			DisableResolveMessage: &integration.DisableResolveMessage,
			Settings:              common.Unstructured{Object: maps.Clone(integration.Settings)},
			SecureFields:          integration.SecureFields(),
		})
	}

	r := &model.Receiver{
		TypeMeta: resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			UID:             types.UID(receiver.GetUID()), // This is needed to make PATCH work
			Name:            receiver.GetUID(),
			Namespace:       namespacer(orgID),
			ResourceVersion: receiver.Version,
		},
		Spec: spec,
	}
	r.SetProvenanceStatus(string(receiver.Provenance))
	return r, nil
}

func convertToDomainModel(receiver *model.Receiver) (*ngmodels.Receiver, map[string][]string, error) {
	domain := &ngmodels.Receiver{
		UID:          legacy_storage.NameToUid(receiver.Spec.Title),
		Name:         receiver.Spec.Title,
		Integrations: make([]*ngmodels.Integration, 0, len(receiver.Spec.Integrations)),
		Version:      receiver.ResourceVersion,
		Provenance:   ngmodels.ProvenanceNone,
	}

	storedSecureFields := make(map[string][]string, len(receiver.Spec.Integrations))
	for _, integration := range receiver.Spec.Integrations {
		config, err := ngmodels.IntegrationConfigFromType(integration.Type)
		if err != nil {
			return nil, nil, err
		}
		grafanaIntegration := ngmodels.Integration{
			Name:           receiver.Spec.Title,
			Config:         config,
			Settings:       maps.Clone(integration.Settings.UnstructuredContent()),
			SecureSettings: make(map[string]string),
		}
		if integration.Uid != nil {
			grafanaIntegration.UID = *integration.Uid
		}
		if integration.DisableResolveMessage != nil {
			grafanaIntegration.DisableResolveMessage = *integration.DisableResolveMessage
		}

		domain.Integrations = append(domain.Integrations, &grafanaIntegration)

		if grafanaIntegration.UID != "" {
			// This is an existing integration, so we track the secure fields being requested to copy over from existing values.
			secureFields := make([]string, 0, len(integration.SecureFields))
			for k, isSecure := range integration.SecureFields {
				if isSecure {
					secureFields = append(secureFields, k)
				}
			}
			storedSecureFields[grafanaIntegration.UID] = secureFields
		}
	}

	return domain, storedSecureFields, nil
}
