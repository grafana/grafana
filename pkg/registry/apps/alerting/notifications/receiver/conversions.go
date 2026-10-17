package receiver

import (
	"encoding/json"
	"fmt"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers/schema"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
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
	access *ngmodels.ReceiverPermissionSet,
	metadata *ngmodels.ReceiverMetadata,
	namespacer request.NamespaceMapper,
) (*model.Receiver, error) {
	spec := model.ReceiverSpec{
		Title:        receiver.Name,
		Integrations: make([]model.ReceiverIntegration, 0, len(receiver.Integrations)),
	}
	for _, integration := range receiver.Integrations {
		k8sIntegration, err := integrationToK8sIntegration(integration)
		if err != nil {
			return nil, err
		}
		spec.Integrations = append(spec.Integrations, k8sIntegration)
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

func convertToDomainModel(receiver *model.Receiver) (*ngmodels.Receiver, map[string][]string, error) {
	prov, err := ngmodels.ProvenanceFromString(receiver.GetProvenanceStatus())
	if err != nil {
		return nil, nil, ngmodels.ErrReceiverInvalid(err)
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
			return nil, nil, err
		}
		domain.Integrations = append(domain.Integrations, &grafanaIntegration)
		storedSecureFields[grafanaIntegration.UID] = secureFields
	}

	return domain, storedSecureFields, nil
}

func convertReceiverIntegrationToIntegration(receiverTitle string, integration model.ReceiverIntegration) (ngmodels.Integration, []string, error) {
	flat, err := flattenK8sIntegration(integration)
	if err != nil {
		return ngmodels.Integration{}, nil, err
	}

	t, err := alertingNotify.IntegrationTypeFromString(flat.Type)
	if err != nil {
		return ngmodels.Integration{}, nil, ngmodels.ErrReceiverInvalid(err)
	}
	var config schema.IntegrationSchemaVersion
	typeSchema, _ := alertingNotify.GetSchemaForIntegration(t)
	// TODO:yuri make version required when UI is updated
	if flat.Version != "" {
		var ok bool
		config, ok = typeSchema.GetVersion(schema.Version(flat.Version))
		if !ok {
			return ngmodels.Integration{}, nil, ngmodels.ErrReceiverInvalid(fmt.Errorf("invalid version %s for integration type %s", flat.Version, flat.Type))
		}
	} else {
		config = typeSchema.GetCurrentVersion()
	}
	grafanaIntegration := ngmodels.Integration{
		Name:           receiverTitle,
		Config:         config,
		Settings:       flat.Settings,
		SecureSettings: make(map[string]string),
	}
	if flat.Uid != nil {
		grafanaIntegration.UID = *flat.Uid
	}
	if flat.DisableResolveMessage != nil {
		grafanaIntegration.DisableResolveMessage = *flat.DisableResolveMessage
	}

	var secureFields []string
	if grafanaIntegration.UID != "" {
		// This is an existing integration, so we track the secure fields being requested to copy over from existing values.
		secureFields = make([]string, 0, len(flat.SecureFields))
		for k, isSecure := range flat.SecureFields {
			if isSecure {
				secureFields = append(secureFields, k)
			}
		}
	}
	return grafanaIntegration, secureFields, nil
}

// flatIntegration is the shape shared by every branch of the generated integration
// union. Converting through JSON lets the generated codec pick the branch, so this
// package does not need a case per integration type and version.
type flatIntegration struct {
	Uid                   *string         `json:"uid,omitempty"`
	DisableResolveMessage *bool           `json:"disableResolveMessage,omitempty"`
	Type                  string          `json:"type"`
	Version               string          `json:"version"`
	Variant               string          `json:"variant"`
	Settings              map[string]any  `json:"settings"`
	SecureFields          map[string]bool `json:"secureFields,omitempty"`
}

// integrationToK8sIntegration converts a domain integration into the union the API
// serves. It builds the flat form and lets the generated UnmarshalJSON select the
// branch from the `variant` discriminator.
func integrationToK8sIntegration(integration *ngmodels.Integration) (model.ReceiverIntegration, error) {
	var result model.ReceiverIntegration

	integrationType := string(integration.Config.Type())
	version := string(integration.Config.Version)

	raw, err := json.Marshal(flatIntegration{
		Uid:                   &integration.UID,
		DisableResolveMessage: &integration.DisableResolveMessage,
		Type:                  integrationType,
		Version:               version,
		Variant:               integrationType + "/" + version,
		Settings:              integration.Settings,
		SecureFields:          integration.SecureFields(),
	})
	if err != nil {
		return result, err
	}
	if err := json.Unmarshal(raw, &result); err != nil {
		return result, err
	}
	// An unrecognised type and version pair leaves every branch unset, which marshals
	// back to null. Report that rather than serving an empty integration.
	if matched, err := json.Marshal(result); err == nil && string(matched) == "null" {
		return result, ngmodels.ErrReceiverInvalid(fmt.Errorf("unsupported integration type and version %s/%s", integrationType, version))
	}

	return result, nil
}

// flattenK8sIntegration recovers the flat form from whichever branch of the union is
// set, using the generated MarshalJSON.
func flattenK8sIntegration(integration model.ReceiverIntegration) (flatIntegration, error) {
	var flat flatIntegration

	raw, err := json.Marshal(integration)
	if err != nil {
		return flat, err
	}
	if string(raw) == "null" {
		return flat, ngmodels.ErrReceiverInvalid(fmt.Errorf("integration matched no known type and version"))
	}
	if err := json.Unmarshal(raw, &flat); err != nil {
		return flat, err
	}

	return flat, nil
}

// convertTestIntegrationToIntegration converts the flat integration the test route
// accepts into the domain model. That route keeps the flat shape because codegen does
// not allow a union in a request body.
func convertTestIntegrationToIntegration(receiverTitle string, integration model.CreateReceiverIntegrationTestRequestIntegrationInput) (ngmodels.Integration, []string, error) {
	t, err := alertingNotify.IntegrationTypeFromString(integration.Type)
	if err != nil {
		return ngmodels.Integration{}, nil, ngmodels.ErrReceiverInvalid(err)
	}
	var config schema.IntegrationSchemaVersion
	typeSchema, _ := alertingNotify.GetSchemaForIntegration(t)
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
		Settings:       integration.Settings,
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
		secureFields = make([]string, 0, len(integration.SecureFields))
		for k, isSecure := range integration.SecureFields {
			if isSecure {
				secureFields = append(secureFields, k)
			}
		}
	}
	return grafanaIntegration, secureFields, nil
}
