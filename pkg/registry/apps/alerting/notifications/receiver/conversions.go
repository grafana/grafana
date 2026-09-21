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
	uid, disableResolveMessage, integrationType, integrationVersion, integrationSettings, integrationSecureFields, err := flattenK8sIntegration(integration)
	if err != nil {
		return ngmodels.Integration{}, nil, err
	}

	t, err := alertingNotify.IntegrationTypeFromString(integrationType)
	if err != nil {
		return ngmodels.Integration{}, nil, ngmodels.ErrReceiverInvalid(err)
	}
	var config schema.IntegrationSchemaVersion
	typeSchema, _ := alertingNotify.GetSchemaForIntegration(t)
	// TODO:yuri make version required when UI is updated
	if integrationVersion != "" {
		var ok bool
		config, ok = typeSchema.GetVersion(schema.Version(integrationVersion))
		if !ok {
			return ngmodels.Integration{}, nil, ngmodels.ErrReceiverInvalid(fmt.Errorf("invalid version %s for integration type %s", integrationVersion, integrationType))
		}
	} else {
		config = typeSchema.GetCurrentVersion()
	}
	grafanaIntegration := ngmodels.Integration{
		Name:           receiverTitle,
		Config:         config,
		Settings:       integrationSettings,
		SecureSettings: make(map[string]string),
	}
	if uid != nil {
		grafanaIntegration.UID = *uid
	}
	if disableResolveMessage != nil {
		grafanaIntegration.DisableResolveMessage = *disableResolveMessage
	}

	var secureFields []string
	if grafanaIntegration.UID != "" {
		// This is an existing integration, so we track the secure fields being requested to copy over from existing values.
		secureFields = make([]string, 0, len(integrationSecureFields))
		for k, isSecure := range integrationSecureFields {
			if isSecure {
				secureFields = append(secureFields, k)
			}
		}
	}
	return grafanaIntegration, secureFields, nil
}

// variantOf builds the value of the discriminator field: the type and version pair
// that says which shape an integration's settings have.
func variantOf(integrationType, version string) string {
	return integrationType + "/" + version
}

// integrationToK8sIntegration picks the union branch matching the integration's type
// and version, and fills in its settings.
//
// Settings go through JSON rather than being copied field by field: the domain model
// holds them as a map, and each branch has a struct with the fields that version
// actually accepts.
func integrationToK8sIntegration(integration *ngmodels.Integration) (model.ReceiverIntegration, error) {
	var (
		integrationType = string(integration.Config.Type())
		version         = string(integration.Config.Version)
		variant         = variantOf(integrationType, version)
		uid             = &integration.UID
		disable         = &integration.DisableResolveMessage
		secureFields    = integration.SecureFields()
		result          model.ReceiverIntegration
	)

	rawSettings, err := json.Marshal(integration.Settings)
	if err != nil {
		return result, err
	}

	switch variant {
	case "email/v1":
		branch := model.ReceiverEmailV1{Type: integrationType, Version: version, Variant: &variant, Uid: uid, DisableResolveMessage: disable}
		if err := json.Unmarshal(rawSettings, &branch.Settings); err != nil {
			return result, err
		}
		result.EmailV1 = &branch
	case "email/v0mimir1":
		branch := model.ReceiverEmailMimir1{Type: integrationType, Version: version, Variant: &variant, Uid: uid, DisableResolveMessage: disable}
		if err := json.Unmarshal(rawSettings, &branch.Settings); err != nil {
			return result, err
		}
		result.EmailMimir1 = &branch
	case "slack/v1":
		branch := model.ReceiverSlackV1{Type: integrationType, Version: version, Variant: &variant, Uid: uid, DisableResolveMessage: disable}
		if err := json.Unmarshal(rawSettings, &branch.Settings); err != nil {
			return result, err
		}
		branch.SecureFields = slackV1SecureFields(secureFields)
		result.SlackV1 = &branch
	case "slack/v0mimir1":
		branch := model.ReceiverSlackMimir1{Type: integrationType, Version: version, Variant: &variant, Uid: uid, DisableResolveMessage: disable}
		if err := json.Unmarshal(rawSettings, &branch.Settings); err != nil {
			return result, err
		}
		result.SlackMimir1 = &branch
	case "webhook/v1":
		branch := model.ReceiverWebhookV1{Type: integrationType, Version: version, Variant: &variant, Uid: uid, DisableResolveMessage: disable}
		if err := json.Unmarshal(rawSettings, &branch.Settings); err != nil {
			return result, err
		}
		branch.SecureFields = secureFields
		result.WebhookV1 = &branch
	default:
		return result, ngmodels.ErrReceiverInvalid(fmt.Errorf("unsupported integration type and version %s", variant))
	}

	return result, nil
}

func slackV1SecureFields(secureFields map[string]bool) *model.ReceiverV1beta1SlackV1SecureFields {
	if len(secureFields) == 0 {
		return nil
	}
	out := model.ReceiverV1beta1SlackV1SecureFields{}
	if secureFields["token"] {
		v := true
		out.Token = &v
	}
	if secureFields["url"] {
		v := true
		out.Url = &v
	}
	return &out
}

// flattenK8sIntegration recovers the type, version, settings and secure fields from
// whichever union branch is set.
func flattenK8sIntegration(integration model.ReceiverIntegration) (uid *string, disableResolveMessage *bool, integrationType string, version string, settings map[string]any, secureFields map[string]bool, err error) {
	var rawSettings []byte

	switch {
	case integration.EmailV1 != nil:
		b := integration.EmailV1
		uid, disableResolveMessage, integrationType, version = b.Uid, b.DisableResolveMessage, b.Type, b.Version
		rawSettings, err = json.Marshal(b.Settings)
	case integration.EmailMimir1 != nil:
		b := integration.EmailMimir1
		uid, disableResolveMessage, integrationType, version = b.Uid, b.DisableResolveMessage, b.Type, b.Version
		rawSettings, err = json.Marshal(b.Settings)
	case integration.SlackV1 != nil:
		b := integration.SlackV1
		uid, disableResolveMessage, integrationType, version = b.Uid, b.DisableResolveMessage, b.Type, b.Version
		rawSettings, err = json.Marshal(b.Settings)
		if b.SecureFields != nil {
			secureFields = map[string]bool{}
			if b.SecureFields.Token != nil {
				secureFields["token"] = *b.SecureFields.Token
			}
			if b.SecureFields.Url != nil {
				secureFields["url"] = *b.SecureFields.Url
			}
		}
	case integration.SlackMimir1 != nil:
		b := integration.SlackMimir1
		uid, disableResolveMessage, integrationType, version = b.Uid, b.DisableResolveMessage, b.Type, b.Version
		rawSettings, err = json.Marshal(b.Settings)
	case integration.WebhookV1 != nil:
		b := integration.WebhookV1
		uid, disableResolveMessage, integrationType, version = b.Uid, b.DisableResolveMessage, b.Type, b.Version
		rawSettings, err = json.Marshal(b.Settings)
		secureFields = b.SecureFields
	default:
		return nil, nil, "", "", nil, nil, ngmodels.ErrReceiverInvalid(fmt.Errorf("integration matched no known type and version"))
	}

	if err != nil {
		return nil, nil, "", "", nil, nil, err
	}
	if err = json.Unmarshal(rawSettings, &settings); err != nil {
		return nil, nil, "", "", nil, nil, err
	}

	return uid, disableResolveMessage, integrationType, version, settings, secureFields, nil
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
