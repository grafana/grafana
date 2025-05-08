package v0alpha2

import (
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apiserver/pkg/registry/generic"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
)

func (o *Receiver) GetProvenanceStatus() string {
	if o == nil || o.Annotations == nil {
		return ""
	}
	s, ok := o.Annotations[v0alpha1.ProvenanceStatusAnnotationKey]
	if !ok || s == "" {
		return v0alpha1.ProvenanceStatusNone
	}
	return s
}

func (o *Receiver) SetProvenanceStatus(status string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	if status == "" {
		status = v0alpha1.ProvenanceStatusNone
	}
	o.Annotations[v0alpha1.ProvenanceStatusAnnotationKey] = status
}

func (o *Receiver) SetAccessControl(action string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 1)
	}
	o.Annotations[AccessControlAnnotation(action)] = "true"
}

// AccessControlAnnotation returns the key for the access control annotation for the given action.
// Ex. grafana.com/access/canDelete.
func AccessControlAnnotation(action string) string {
	return fmt.Sprintf("%s%s/%s", v0alpha1.InternalPrefix, "access", action)
}

func (o *Receiver) SetInUse(routesCnt int, rules []string) {
	if o.Annotations == nil {
		o.Annotations = make(map[string]string, 2)
	}
	o.Annotations[InUseAnnotation("routes")] = fmt.Sprintf("%d", routesCnt)
	o.Annotations[InUseAnnotation("rules")] = fmt.Sprintf("%d", len(rules))
}

func (s *Spec) GetIntegrationsTypes() []string {
	response := make([]string, 0, 5)
	if len(s.Integrations.Alertmanager) > 0 {
		response = append(response, "alertmanager")
	}
	if len(s.Integrations.Discord) > 0 {
		response = append(response, "discord")
	}
	if len(s.Integrations.Email) > 0 {
		response = append(response, "email")
	}
	if len(s.Integrations.Googlechat) > 0 {
		response = append(response, "googlechat")
	}
	if len(s.Integrations.Kafka) > 0 {
		response = append(response, "kafka")
	}
	if len(s.Integrations.Line) > 0 {
		response = append(response, "line")
	}
	if len(s.Integrations.Opsgenie) > 0 {
		response = append(response, "opsgenie")
	}
	if len(s.Integrations.Pagerduty) > 0 {
		response = append(response, "pagerduty")
	}
	if len(s.Integrations.Pushover) > 0 {
		response = append(response, "pushover")
	}
	if len(s.Integrations.Sensugo) > 0 {
		response = append(response, "sensu")
	}
	if len(s.Integrations.Slack) > 0 {
		response = append(response, "slack")
	}
	if len(s.Integrations.Teams) > 0 {
		response = append(response, "teams")
	}
	if len(s.Integrations.Telegram) > 0 {
		response = append(response, "telegram")
	}
	if len(s.Integrations.Threema) > 0 {
		response = append(response, "threema")
	}
	if len(s.Integrations.Victorops) > 0 {
		response = append(response, "victorops")
	}
	if len(s.Integrations.Webhook) > 0 {
		response = append(response, "webhook")
	}
	if len(s.Integrations.Wecom) > 0 {
		response = append(response, "wecom")
	}
	return response
}

func (s *Spec) IntegrationsCount() int {
	return len(s.Integrations.Alertmanager) + len(s.Integrations.Dingding) + len(s.Integrations.Discord) + len(s.Integrations.Email) +
		len(s.Integrations.Googlechat) + len(s.Integrations.Kafka) + len(s.Integrations.Line) + len(s.Integrations.Opsgenie) +
		len(s.Integrations.Pagerduty) + len(s.Integrations.Oncall) + len(s.Integrations.Pushover) + len(s.Integrations.Sensugo) +
		len(s.Integrations.Sns) + len(s.Integrations.Slack) + len(s.Integrations.Teams) + len(s.Integrations.Telegram) +
		len(s.Integrations.Threema) + len(s.Integrations.Victorops) + len(s.Integrations.Webhook) + len(s.Integrations.Wecom) +
		len(s.Integrations.Webex) + len(s.Integrations.Mqtt)
}

// InUseAnnotation returns the key for the in-use annotation for the given resource.
// Ex. grafana.com/inUse/routes, grafana.com/inUse/rules.
func InUseAnnotation(resource string) string {
	return fmt.Sprintf("%s%s/%s", v0alpha1.InternalPrefix, "inUse", resource)
}

func SelectableFields(obj *Receiver) fields.Set {
	if obj == nil {
		return nil
	}
	selectable := Schema().SelectableFields()
	set := make(fields.Set, len(selectable))
	for _, field := range selectable {
		f, err := field.FieldValueFunc(obj)
		if err != nil {
			continue
		}
		set[field.FieldSelector] = f
	}
	return generic.MergeFieldsSets(generic.ObjectMetaFieldsSet(&obj.ObjectMeta, false), set)
}
