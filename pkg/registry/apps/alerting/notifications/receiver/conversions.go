package receiver

import (
	"fmt"
	"maps"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func convertToK8sResources(
	orgID int64,
	receivers []*ngmodels.Receiver,
	managerPropsMap map[string]utils.ManagerProperties,
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
		k8sResource, err := convertToK8sResource(orgID, receiver, managerPropsMap[receiver.GetUID()], access, metadata, namespacer)
		if err != nil {
			return nil, err
		}
		if selector != nil && !selector.Empty() && !selector.Matches(model.ReceiverSelectableFields(k8sResource)) {
			continue
		}
		result.Items = append(result.Items, *k8sResource)
	}
	return result, nil
}

func convertToK8sResource(
	orgID int64,
	receiver *ngmodels.Receiver,
	managerProps utils.ManagerProperties,
	access *ngmodels.ReceiverPermissionSet,
	metadata *ngmodels.ReceiverMetadata,
	namespacer request.NamespaceMapper,
) (*model.Receiver, error) {
	spec := model.ReceiverSpec{
		Title:        receiver.Name,
		Integrations: make([]model.ReceiverIntegration, 0, len(receiver.Integrations)),
	}
	for _, integration := range receiver.Integrations {
		spec.Integrations = append(spec.Integrations, model.ReceiverIntegration{
			Uid:                   &integration.UID,
			Type:                  string(integration.Config.Type()),
			Version:               string(integration.Config.Version),
			DisableResolveMessage: &integration.DisableResolveMessage,
			Settings:              maps.Clone(integration.Settings),
			SecureFields:          integration.SecureFields(),
		})
	}

	r := &model.Receiver{
		TypeMeta: metav1.TypeMeta{
			APIVersion: kind.GroupVersionKind().GroupVersion().String(),
			Kind:       kind.Kind(),
		},
		ObjectMeta: metav1.ObjectMeta{
			UID:             types.UID(receiver.GetUID()), // This is needed to make PATCH work
			Name:            receiver.GetUID(),
			Namespace:       namespacer(orgID),
			ResourceVersion: receiver.Version,
		},
		Spec: spec,
	}
	// Prefer the richer manager-derived provenance; fall back to whatever provenance the
	// caller already resolved (e.g. imported receivers' converted-Prometheus provenance).
	provenance := receiver.Provenance
	if managerProps.Kind != utils.ManagerKindUnknown {
		provenance = ngmodels.ManagerPropertiesToProvenance(managerProps)
	}
	r.SetProvenanceStatus(string(provenance))

	if managerProps.Kind != utils.ManagerKindUnknown {
		if meta, err := utils.MetaAccessor(r); err == nil {
			meta.SetManagerProperties(managerProps)
		}
	}

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
		r.SetCanUse(metadata.CanUse)
	}
	r.UID = gapiutil.CalculateClusterWideUID(r)
	return r, nil
}

var permissionMapper = map[ngmodels.ReceiverPermission]string{
	ngmodels.ReceiverPermissionReadSecret:      "canReadSecrets",
	ngmodels.ReceiverPermissionAdmin:           "canAdmin",
	ngmodels.ReceiverPermissionWrite:           "canWrite",
	ngmodels.ReceiverPermissionDelete:          "canDelete",
	ngmodels.ReceiverPermissionModifyProtected: "canModifyProtected",
	ngmodels.ReceiverPermissionTest:            "canTest",
}

func convertToDomainModel(receiver *model.Receiver) (*ngmodels.Receiver, map[string][]string, utils.ManagerProperties, error) {
	managerProps, prov, err := extractManagerProperties(receiver)
	if err != nil {
		return nil, nil, utils.ManagerProperties{}, ngmodels.ErrReceiverInvalid(err)
	}
	domain := &ngmodels.Receiver{
		UID:          receiver.Name,
		Name:         receiver.Spec.Title,
		Integrations: make([]*ngmodels.Integration, 0, len(receiver.Spec.Integrations)),
		Version:      receiver.ResourceVersion,
		Provenance:   prov,
		Origin:       ngmodels.ResourceOriginGrafana, // Set to Grafana by default.
	}
	storedSecureFields := make(map[string][]string, len(receiver.Spec.Integrations))
	for _, integration := range receiver.Spec.Integrations {
		grafanaIntegration, secureFields, err := convertReceiverIntegrationToIntegration(receiver.Spec.Title, integration)
		if err != nil {
			return nil, nil, utils.ManagerProperties{}, err
		}
		domain.Integrations = append(domain.Integrations, &grafanaIntegration)
		storedSecureFields[grafanaIntegration.UID] = secureFields
	}

	return domain, storedSecureFields, managerProps, nil
}

// extractManagerProperties resolves the ManagerProperties for an inbound object, preferring the
// manager annotations (richer than the coarse provenance annotation) when present and validating
// that they agree with any explicit provenance annotation. It falls back to deriving
// ManagerProperties from the provenance annotation for objects that pre-date ManagerProperties.
func extractManagerProperties(receiver *model.Receiver) (utils.ManagerProperties, ngmodels.Provenance, error) {
	meta, err := utils.MetaAccessor(receiver)
	if err != nil {
		return utils.ManagerProperties{}, "", fmt.Errorf("failed to get metadata: %w", err)
	}
	if mp, ok := meta.GetManagerProperties(); ok {
		if sourceProv := receiver.GetProvenanceStatus(); sourceProv != "" && sourceProv != string(ngmodels.ProvenanceNone) {
			derivedProv := string(ngmodels.ManagerPropertiesToProvenance(mp))
			if derivedProv != sourceProv {
				return utils.ManagerProperties{}, "", fmt.Errorf("manager properties (kind=%s) and provenance annotation (%s) are inconsistent: manager properties imply provenance %q",
					mp.Kind, sourceProv, derivedProv)
			}
		}
		return mp, ngmodels.ManagerPropertiesToProvenance(mp), nil
	}

	prov, err := ngmodels.ProvenanceFromString(receiver.GetProvenanceStatus())
	if err != nil {
		return utils.ManagerProperties{}, "", err
	}
	return ngmodels.ProvenanceToManagerProperties(prov), prov, nil
}

func convertReceiverIntegrationToIntegration(receiverTitle string, integration model.ReceiverIntegration) (ngmodels.Integration, []string, error) {
	t, err := alertingNotify.IntegrationTypeFromString(integration.Type)
	if err != nil {
		return ngmodels.Integration{}, nil, ngmodels.ErrReceiverInvalid(err)
	}
	var config schema.IntegrationSchemaVersion
	typeSchema, _ := alertingNotify.GetSchemaForIntegration(t)
	// TODO:yuri make version required when UI is updated
	if integration.Version != "" {
		var ok bool
		config, ok = typeSchema.GetVersion(schema.Version(integration.Version))
		if !ok {
			return ngmodels.Integration{}, nil, ngmodels.ErrReceiverInvalid(fmt.Errorf("invalid version %s for integration type %s", integration.Version, integration.Type))
		}
	} else {
		config = typeSchema.GetCurrentVersion()
	}
	grafanaIntegration := ngmodels.Integration{
		Name:           receiverTitle,
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

	var secureFields []string
	if grafanaIntegration.UID != "" {
		// This is an existing integration, so we track the secure fields being requested to copy over from existing values.
		secureFields = make([]string, 0, len(integration.SecureFields))
		for k, isSecure := range integration.SecureFields {
			if isSecure {
				secureFields = append(secureFields, k)
			}
		}
	}
	return grafanaIntegration, secureFields, nil
}
