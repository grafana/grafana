package v0alpha2

import (
	"errors"
	"fmt"
	"strings"
	"unsafe"

	"github.com/grafana/alerting/receivers"

	jsoniter "github.com/json-iterator/go"
	"github.com/modern-go/reflect2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/receiver/v0alpha2"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
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
	spec, err := specFromDomainReceiver(receiver)
	if err != nil {
		return nil, err
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

// ContactPointFromContactPointExport parses the database model of the contact point (group of integrations) where settings are represented in JSON,
// to strongly typed ContactPoint.
func specFromDomainReceiver(domain *ngmodels.Receiver) (model.Spec, error) {
	j := jsoniter.ConfigCompatibleWithStandardLibrary
	j.RegisterExtension(&contactPointsExtension{})

	result := model.Spec{
		Title: domain.Name,
	}

	var errs []error
	for _, rawIntegration := range domain.Integrations {
		err := parseIntegration(j, &result, rawIntegration)
		if err != nil {
			// accumulate errors to report all at once.
			errs = append(errs, fmt.Errorf("failed to parse %s integration (uid:%s): %w", rawIntegration.Config.Type, rawIntegration.UID, err))
		}
	}
	return result, errors.Join(errs...)
}

// ContactPointToContactPointExport converts v0alpha2.Receiver to models.Receiver.
// It uses a special extension for json-iterator API that properly handles marshaling of some specific fields.
//
//nolint:gocyclo
func convertToDomainModel(apiModel *model.Receiver) (*ngmodels.Receiver, error) {
	j := jsoniter.ConfigCompatibleWithStandardLibrary
	// use json iterator with custom extension that has special codec for some field.
	// This is needed to keep the API models clean and convert from a database model
	j.RegisterExtension(&contactPointsExtension{})

	cp := apiModel.Spec

	integration := make([]*ngmodels.Integration, 0, apiModel.Spec.IntegrationsCount())

	var errs []error
	for _, i := range cp.Alertmanager {
		el, err := marshallIntegration(j, "prometheus-alertmanager", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Dingding {
		el, err := marshallIntegration(j, "dingding", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Discord {
		el, err := marshallIntegration(j, "discord", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Email {
		el, err := marshallIntegration(j, "email", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Googlechat {
		el, err := marshallIntegration(j, "googlechat", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Jira {
		el, err := marshallIntegration(j, "jira", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Kafka {
		el, err := marshallIntegration(j, "kafka", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Line {
		el, err := marshallIntegration(j, "line", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Mqtt {
		el, err := marshallIntegration(j, "mqtt", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Opsgenie {
		el, err := marshallIntegration(j, "opsgenie", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Pagerduty {
		el, err := marshallIntegration(j, "pagerduty", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Oncall {
		el, err := marshallIntegration(j, "oncall", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Pushover {
		el, err := marshallIntegration(j, "pushover", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Sensugo {
		el, err := marshallIntegration(j, "sensugo", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Sns {
		el, err := marshallIntegration(j, "sns", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Slack {
		el, err := marshallIntegration(j, "slack", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Teams {
		el, err := marshallIntegration(j, "teams", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Telegram {
		el, err := marshallIntegration(j, "telegram", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Threema {
		el, err := marshallIntegration(j, "threema", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Victorops {
		el, err := marshallIntegration(j, "victorops", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Webhook {
		el, err := marshallIntegration(j, "webhook", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Wecom {
		el, err := marshallIntegration(j, "wecom", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Webex {
		el, err := marshallIntegration(j, "webex", i, i.DisableResolveMessage, i.Uid, cp.Title)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}

	if len(errs) > 0 {
		return nil, errors.Join(errs...)
	}
	result := &ngmodels.Receiver{
		UID:          apiModel.Name,
		Name:         apiModel.Spec.Title,
		Integrations: integration,
		Provenance:   ngmodels.Provenance(apiModel.GetProvenanceStatus()),
		Version:      apiModel.ResourceVersion,
	}
	return result, nil
}

// marshallIntegration converts the API model integration to the storage model that contains settings in the JSON format.
// The secret fields are not encrypted.
func marshallIntegration(json jsoniter.API, integrationType string, integration interface{}, disableResolveMessage *bool, uid *string, name string) (*ngmodels.Integration, error) {
	data, err := json.Marshal(integration)
	if err != nil {
		return nil, fmt.Errorf("failed to marshall integration '%s' to JSON: %w", integrationType, err)
	}
	settings := map[string]interface{}{}
	err = json.Unmarshal(data, &settings)
	delete(settings, "uid") // integration UID is part of the integration
	if err != nil {
		return nil, fmt.Errorf("failed to marshall integration '%s' to map: %w", integrationType, err)
	}

	config, err := ngmodels.IntegrationConfigFromType(integrationType)
	if err != nil {
		return nil, err
	}

	e := &ngmodels.Integration{
		UID:            "",
		Name:           name,
		Config:         config,
		Settings:       settings,
		SecureSettings: nil,
	}
	if uid != nil {
		e.UID = *uid
	}
	if disableResolveMessage != nil {
		e.DisableResolveMessage = *disableResolveMessage
	}
	return e, nil
}

//nolint:gocyclo
func parseIntegration(json jsoniter.API, result *model.Spec, integration *ngmodels.Integration) error {
	var err error
	var disable *bool
	if integration.DisableResolveMessage { // populate only if true
		disable = util.Pointer(integration.DisableResolveMessage)
	}

	data, err := json.Marshal(integration.Settings)
	if err != nil {
		return fmt.Errorf("failed to marshall integration '%s' to JSON: %w", integration.Config.Type, err)
	}
	switch strings.ToLower(integration.Config.Type) {
	case "prometheus-alertmanager":
		integration := model.AlertmanagerIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Alertmanager = append(result.Alertmanager, integration)
		}
	case "dingding":
		integration := model.DingdingIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Dingding = append(result.Dingding, integration)
		}
	case "discord":
		integration := model.DiscordIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Discord = append(result.Discord, integration)
		}
	case "email":
		integration := model.EmailIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Email = append(result.Email, integration)
		}
	case "googlechat":
		integration := model.GooglechatIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Googlechat = append(result.Googlechat, integration)
		}
	case "jira":
		integration := model.JiraIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Jira = append(result.Jira, integration)
		}
	case "kafka":
		integration := model.KafkaIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Kafka = append(result.Kafka, integration)
		}
	case "line":
		integration := model.LineIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Line = append(result.Line, integration)
		}
	case "mqtt":
		integration := model.MqttIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Mqtt = append(result.Mqtt, integration)
		}
	case "opsgenie":
		integration := model.OpsgenieIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Opsgenie = append(result.Opsgenie, integration)
		}
	case "pagerduty":
		integration := model.PagerdutyIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Pagerduty = append(result.Pagerduty, integration)
		}
	case "oncall":
		integration := model.OnCallIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Oncall = append(result.Oncall, integration)
		}
	case "pushover":
		integration := model.PushoverIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Pushover = append(result.Pushover, integration)
		}
	case "sensugo":
		integration := model.SensugoIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Sensugo = append(result.Sensugo, integration)
		}
	case "sns":
		integration := model.SnsIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Sns = append(result.Sns, integration)
		}
	case "slack":
		integration := model.SlackIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Slack = append(result.Slack, integration)
		}
	case "teams":
		integration := model.TeamsIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Teams = append(result.Teams, integration)
		}
	case "telegram":
		integration := model.TelegramIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Telegram = append(result.Telegram, integration)
		}
	case "threema":
		integration := model.ThreemaIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Threema = append(result.Threema, integration)
		}
	case "victorops":
		integration := model.VictoropsIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Victorops = append(result.Victorops, integration)
		}
	case "webhook":
		integration := model.WebhookIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Webhook = append(result.Webhook, integration)
		}
	case "wecom":
		integration := model.WecomIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Wecom = append(result.Wecom, integration)
		}
	case "webex":
		integration := model.WebexIntegration{DisableResolveMessage: disable, Uid: util.Pointer(integration.UID)}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Webex = append(result.Webex, integration)
		}
	default:
		err = fmt.Errorf("integration %s is not supported", integration.Config.Type)
	}
	return err
}

// contactPointsExtension extends jsoniter with special codecs for some integrations' fields that are encoded differently in the legacy configuration.
type contactPointsExtension struct {
	jsoniter.DummyExtension
}

func (c contactPointsExtension) UpdateStructDescriptor(structDescriptor *jsoniter.StructDescriptor) {
	if structDescriptor.Type == reflect2.TypeOf(model.EmailIntegration{}) {
		bind := structDescriptor.GetField("Addresses")
		codec := &emailAddressCodec{}
		bind.Decoder = codec
		bind.Encoder = codec
	}
	if structDescriptor.Type == reflect2.TypeOf(model.PushoverIntegration{}) {
		codec := &numberAsStringCodec{}
		for _, field := range []string{"Priority", "OkPriority"} {
			desc := structDescriptor.GetField(field)
			desc.Decoder = codec
			desc.Encoder = codec
		}
		// the same logic is in the pushover.NewConfig in alerting module
		codec = &numberAsStringCodec{ignoreError: true}
		for _, field := range []string{"Retry", "Expire"} {
			desc := structDescriptor.GetField(field)
			desc.Decoder = codec
			desc.Encoder = codec
		}
	}
	if structDescriptor.Type == reflect2.TypeOf(model.WebhookIntegration{}) {
		codec := &numberAsStringCodec{ignoreError: true}
		desc := structDescriptor.GetField("MaxAlerts")
		desc.Decoder = codec
		desc.Encoder = codec
	}
	if structDescriptor.Type == reflect2.TypeOf(model.OnCallIntegration{}) {
		codec := &numberAsStringCodec{ignoreError: true}
		desc := structDescriptor.GetField("MaxAlerts")
		desc.Decoder = codec
		desc.Encoder = codec
	}
	if structDescriptor.Type == reflect2.TypeOf(model.MqttIntegration{}) {
		codec := &numberAsStringCodec{ignoreError: true}
		desc := structDescriptor.GetField("Qos")
		desc.Decoder = codec
		desc.Encoder = codec
	}
}

type emailAddressCodec struct{}

func (d *emailAddressCodec) IsEmpty(ptr unsafe.Pointer) bool {
	f := *(*[]string)(ptr)
	return len(f) == 0
}

func (d *emailAddressCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	f := *(*[]string)(ptr)
	addresses := strings.Join(f, ";")
	stream.WriteString(addresses)
}

func (d *emailAddressCodec) Decode(ptr unsafe.Pointer, iter *jsoniter.Iterator) {
	s := iter.ReadString()
	emails := strings.FieldsFunc(strings.Trim(s, "\""), func(r rune) bool {
		switch r {
		case ',', ';', '\n':
			return true
		}
		return false
	})
	*((*[]string)(ptr)) = emails
}

// converts a string representation of a number to *int64
type numberAsStringCodec struct {
	ignoreError bool // if true, then ignores the error and keeps value nil
}

func (d *numberAsStringCodec) IsEmpty(ptr unsafe.Pointer) bool {
	return *((*(*int))(ptr)) == nil
}

func (d *numberAsStringCodec) Encode(ptr unsafe.Pointer, stream *jsoniter.Stream) {
	val := *((*(*int))(ptr))
	if val == nil {
		stream.WriteNil()
		return
	}
	stream.WriteInt(*val)
}

func (d *numberAsStringCodec) Decode(ptr unsafe.Pointer, iter *jsoniter.Iterator) {
	valueType := iter.WhatIsNext()
	var value int64
	switch valueType {
	case jsoniter.NumberValue:
		value = iter.ReadInt64()
	case jsoniter.StringValue:
		var num receivers.OptionalNumber
		err := num.UnmarshalJSON(iter.ReadStringAsSlice())
		if err != nil {
			iter.ReportError("numberAsStringCodec", fmt.Sprintf("failed to unmarshall string as OptionalNumber: %s", err.Error()))
		}
		if num.String() == "" {
			return
		}
		value, err = num.Int64()
		if err != nil {
			if !d.ignoreError {
				iter.ReportError("numberAsStringCodec", fmt.Sprintf("string does not represent an integer number: %s", err.Error()))
			}
			return
		}
	case jsoniter.NilValue:
		iter.ReadNil()
		return
	default:
		iter.ReportError("numberAsStringCodec", "not number or string")
	}
	*((*(*int64))(ptr)) = &value
}
