package receiver

import (
	"fmt"
	"maps"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/receiver/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func convertToK8sResources(
	orgID int64,
	receivers []*ngmodels.Receiver,
	accesses map[string]ngmodels.ReceiverPermissionSet,
	metadatas map[string]ngmodels.ReceiverMetadata,
	namespacer request.NamespaceMapper,
	selector fields.Selector,
) (*model.ReceiverList, error) {
	result := &model.ReceiverList{
		Items: make([]model.Receiver, 0, len(receivers)),
	}
	for _, receiver := range receivers {
		var access *ngmodels.ReceiverPermissionSet
		if accesses != nil {
			if a, ok := accesses[receiver.GetUID()]; ok {
				access = &a
			}
		}
		var metadata *ngmodels.ReceiverMetadata
		if metadatas != nil {
			if m, ok := metadatas[receiver.GetUID()]; ok {
				metadata = &m
			}
		}
		k8sResource, err := convertToK8sResource(orgID, receiver, access, metadata, namespacer)
		if err != nil {
			return nil, err
		}
		if selector != nil && !selector.Empty() && !selector.Matches(model.SelectableFields(k8sResource)) {
			continue
		}
		result.Items = append(result.Items, *k8sResource)
	}
	return result, nil
}

func convertToK8sResource(
	orgID int64,
	receiver *ngmodels.Receiver,
	access *ngmodels.ReceiverPermissionSet,
	metadata *ngmodels.ReceiverMetadata,
	namespacer request.NamespaceMapper,
) (*model.Receiver, error) {
	spec := model.Spec{
		Title:        receiver.Name,
		Integrations: make([]model.Integration, 0, len(receiver.Integrations)),
	}
	for _, integration := range receiver.Integrations {
		spec.Integrations = append(spec.Integrations, model.Integration{
			Uid:                   &integration.UID,
			Type:                  integration.Config.Type,
			DisableResolveMessage: &integration.DisableResolveMessage,
			Settings:              maps.Clone(integration.Settings),
			SecureFields:          integration.SecureFields(),
		})
	}

	r := &model.Receiver{
		ObjectMeta: metav1.ObjectMeta{
			UID:             types.UID(receiver.GetUID()), // This is needed to make PATCH work
			Name:            receiver.GetUID(),
			Namespace:       namespacer(orgID),
			ResourceVersion: receiver.Version,
		},
		Spec: spec,
	}
	r.SetProvenanceStatus(string(receiver.Provenance))

	if access != nil {
		for _, action := range ngmodels.ReceiverPermissions() {
			mappedAction, ok := permissionMapper[action]
			if !ok {
				return nil, fmt.Errorf("unknown action %v", action)
			}
			if can, _ := access.Has(action); can {
				r.SetAccessControl(mappedAction)
			}
		}
	}

	if metadata != nil {
		rules := make([]string, 0, len(metadata.InUseByRules))
		for _, rule := range metadata.InUseByRules {
			rules = append(rules, rule.UID)
		}
		r.SetInUse(metadata.InUseByRoutes, rules)
	}
	r.UID = gapiutil.CalculateClusterWideUID(r)
	return r, nil
}

var permissionMapper = map[ngmodels.ReceiverPermission]string{
	ngmodels.ReceiverPermissionReadSecret: "canReadSecrets",
	ngmodels.ReceiverPermissionAdmin:      "canAdmin",
	ngmodels.ReceiverPermissionWrite:      "canWrite",
	ngmodels.ReceiverPermissionDelete:     "canDelete",
}

func convertToDomainModel(receiver *model.Receiver) (*ngmodels.Receiver, map[string][]string, error) {
	domain := &ngmodels.Receiver{
		UID:          receiver.Name,
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
			Settings:       maps.Clone(integration.Settings),
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
