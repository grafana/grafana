package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unsafe"

	"github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/receivers"
	jsoniter "github.com/json-iterator/go"
	"github.com/modern-go/reflect2"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/util"
)

// ContactPointFromContactPointExport parses the database model of the contact point (group of integrations) where settings are represented in JSON,
// to strongly typed ContactPoint.
func ContactPointFromContactPointExport(rawContactPoint definitions.ContactPointExport) (definitions.ContactPoint, error) {
	j := jsoniter.ConfigCompatibleWithStandardLibrary
	j.RegisterExtension(&contactPointsExtension{})

	contactPoint := definitions.ContactPoint{
		Name: rawContactPoint.Name,
	}
	var errs []error
	for _, rawIntegration := range rawContactPoint.Receivers {
		err := parseIntegration(j, &contactPoint, rawIntegration.Type, rawIntegration.DisableResolveMessage, json.RawMessage(rawIntegration.Settings))
		if err != nil {
			// accumulate errors to report all at once.
			errs = append(errs, fmt.Errorf("failed to parse %s integration (uid:%s): %w", rawIntegration.Type, rawIntegration.UID, err))
		}
	}
	return contactPoint, errors.Join(errs...)
}

// ContactPointToContactPointExport converts definitions.ContactPoint to notify.APIReceiver.
// It uses special extension for json-iterator API that properly handles marshalling of some specific fields.
//
//nolint:gocyclo
func ContactPointToContactPointExport(cp definitions.ContactPoint) (notify.APIReceiver, error) {
	j := jsoniter.ConfigCompatibleWithStandardLibrary
	// use json iterator with custom extension that has special codec for some field.
	// This is needed to keep the API models clean and convert from database model
	j.RegisterExtension(&contactPointsExtension{})

	contactPointsLength := len(cp.Alertmanager) + len(cp.Dingding) + len(cp.Discord) + len(cp.Email) +
		len(cp.Googlechat) + len(cp.Kafka) + len(cp.Line) + len(cp.Opsgenie) +
		len(cp.Pagerduty) + len(cp.OnCall) + len(cp.Pushover) + len(cp.Sensugo) +
		len(cp.Sns) + len(cp.Slack) + len(cp.Teams) + len(cp.Telegram) +
		len(cp.Threema) + len(cp.Victorops) + len(cp.Webhook) + len(cp.Wecom) +
		len(cp.Webex) + len(cp.Mqtt)

	integration := make([]*notify.GrafanaIntegrationConfig, 0, contactPointsLength)

	var errs []error
	for _, i := range cp.Alertmanager {
		el, err := marshallIntegration(j, "prometheus-alertmanager", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Dingding {
		el, err := marshallIntegration(j, "dingding", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Discord {
		el, err := marshallIntegration(j, "discord", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Email {
		el, err := marshallIntegration(j, "email", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Googlechat {
		el, err := marshallIntegration(j, "googlechat", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Jira {
		el, err := marshallIntegration(j, "jira", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Kafka {
		el, err := marshallIntegration(j, "kafka", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Line {
		el, err := marshallIntegration(j, "line", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Mqtt {
		el, err := marshallIntegration(j, "mqtt", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Opsgenie {
		el, err := marshallIntegration(j, "opsgenie", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Pagerduty {
		el, err := marshallIntegration(j, "pagerduty", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.OnCall {
		el, err := marshallIntegration(j, "oncall", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Pushover {
		el, err := marshallIntegration(j, "pushover", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Sensugo {
		el, err := marshallIntegration(j, "sensugo", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Sns {
		el, err := marshallIntegration(j, "sns", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Slack {
		el, err := marshallIntegration(j, "slack", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Teams {
		el, err := marshallIntegration(j, "teams", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Telegram {
		el, err := marshallIntegration(j, "telegram", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Threema {
		el, err := marshallIntegration(j, "threema", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Victorops {
		el, err := marshallIntegration(j, "victorops", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Webhook {
		el, err := marshallIntegration(j, "webhook", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Wecom {
		el, err := marshallIntegration(j, "wecom", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}
	for _, i := range cp.Webex {
		el, err := marshallIntegration(j, "webex", i, i.DisableResolveMessage)
		if err != nil {
			errs = append(errs, err)
		}
		integration = append(integration, el)
	}

	if len(errs) > 0 {
		return notify.APIReceiver{}, errors.Join(errs...)
	}
	contactPoint := notify.APIReceiver{
		ConfigReceiver:      notify.ConfigReceiver{Name: cp.Name},
		GrafanaIntegrations: notify.GrafanaIntegrations{Integrations: integration},
	}
	return contactPoint, nil
}

// marshallIntegration converts the API model integration to the storage model that contains settings in the JSON format.
// The secret fields are not encrypted.
func marshallIntegration(json jsoniter.API, integrationType string, integration interface{}, disableResolveMessage *bool) (*notify.GrafanaIntegrationConfig, error) {
	data, err := json.Marshal(integration)
	if err != nil {
		return nil, fmt.Errorf("failed to marshall integration '%s' to JSON: %w", integrationType, err)
	}
	e := &notify.GrafanaIntegrationConfig{
		Type:     integrationType,
		Settings: data,
	}
	if disableResolveMessage != nil {
		e.DisableResolveMessage = *disableResolveMessage
	}
	return e, nil
}

//nolint:gocyclo
func parseIntegration(json jsoniter.API, result *definitions.ContactPoint, receiverType string, disableResolveMessage bool, data json.RawMessage) error {
	var err error
	var disable *bool
	if disableResolveMessage { // populate only if true
		disable = util.Pointer(disableResolveMessage)
	}
	switch strings.ToLower(receiverType) {
	case "prometheus-alertmanager":
		integration := definitions.AlertmanagerIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Alertmanager = append(result.Alertmanager, integration)
		}
	case "dingding":
		integration := definitions.DingdingIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Dingding = append(result.Dingding, integration)
		}
	case "discord":
		integration := definitions.DiscordIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Discord = append(result.Discord, integration)
		}
	case "email":
		integration := definitions.EmailIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Email = append(result.Email, integration)
		}
	case "googlechat":
		integration := definitions.GooglechatIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Googlechat = append(result.Googlechat, integration)
		}
	case "jira":
		integration := definitions.JiraIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Jira = append(result.Jira, integration)
		}
	case "kafka":
		integration := definitions.KafkaIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Kafka = append(result.Kafka, integration)
		}
	case "line":
		integration := definitions.LineIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Line = append(result.Line, integration)
		}
	case "mqtt":
		integration := definitions.MqttIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Mqtt = append(result.Mqtt, integration)
		}
	case "opsgenie":
		integration := definitions.OpsgenieIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Opsgenie = append(result.Opsgenie, integration)
		}
	case "pagerduty":
		integration := definitions.PagerdutyIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Pagerduty = append(result.Pagerduty, integration)
		}
	case "oncall":
		integration := definitions.OnCallIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.OnCall = append(result.OnCall, integration)
		}
	case "pushover":
		integration := definitions.PushoverIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Pushover = append(result.Pushover, integration)
		}
	case "sensugo":
		integration := definitions.SensugoIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Sensugo = append(result.Sensugo, integration)
		}
	case "sns":
		integration := definitions.SnsIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Sns = append(result.Sns, integration)
		}
	case "slack":
		integration := definitions.SlackIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Slack = append(result.Slack, integration)
		}
	case "teams":
		integration := definitions.TeamsIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Teams = append(result.Teams, integration)
		}
	case "telegram":
		integration := definitions.TelegramIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Telegram = append(result.Telegram, integration)
		}
	case "threema":
		integration := definitions.ThreemaIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Threema = append(result.Threema, integration)
		}
	case "victorops":
		integration := definitions.VictoropsIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Victorops = append(result.Victorops, integration)
		}
	case "webhook":
		integration := definitions.WebhookIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Webhook = append(result.Webhook, integration)
		}
	case "wecom":
		integration := definitions.WecomIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Wecom = append(result.Wecom, integration)
		}
	case "webex":
		integration := definitions.WebexIntegration{DisableResolveMessage: disable}
		if err = json.Unmarshal(data, &integration); err == nil {
			result.Webex = append(result.Webex, integration)
		}
	default:
		err = fmt.Errorf("integration %s is not supported", receiverType)
	}
	return err
}

// contactPointsExtension extends jsoniter with special codecs for some integrations' fields that are encoded differently in the legacy configuration.
type contactPointsExtension struct {
	jsoniter.DummyExtension
}

func (c contactPointsExtension) UpdateStructDescriptor(structDescriptor *jsoniter.StructDescriptor) {
	if structDescriptor.Type == reflect2.TypeOf(definitions.EmailIntegration{}) {
		bind := structDescriptor.GetField("Addresses")
		codec := &emailAddressCodec{}
		bind.Decoder = codec
		bind.Encoder = codec
	}
	if structDescriptor.Type == reflect2.TypeOf(definitions.PushoverIntegration{}) {
		codec := &numberAsStringCodec{}
		for _, field := range []string{"AlertingPriority", "OKPriority"} {
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
	if structDescriptor.Type == reflect2.TypeOf(definitions.WebhookIntegration{}) {
		codec := &numberAsStringCodec{ignoreError: true}
		desc := structDescriptor.GetField("MaxAlerts")
		desc.Decoder = codec
		desc.Encoder = codec
	}
	if structDescriptor.Type == reflect2.TypeOf(definitions.OnCallIntegration{}) {
		codec := &numberAsStringCodec{ignoreError: true}
		desc := structDescriptor.GetField("MaxAlerts")
		desc.Decoder = codec
		desc.Encoder = codec
	}
	if structDescriptor.Type == reflect2.TypeOf(definitions.MqttIntegration{}) {
		codec := &numberAsStringCodec{ignoreError: true}
		desc := structDescriptor.GetField("QoS")
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
