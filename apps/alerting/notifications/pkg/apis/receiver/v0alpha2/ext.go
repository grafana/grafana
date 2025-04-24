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
	if len(s.Alertmanager) > 0 {
		response = append(response, "alertmanager")
	}
	if len(s.Discord) > 0 {
		response = append(response, "discord")
	}
	if len(s.Email) > 0 {
		response = append(response, "email")
	}
	if len(s.Googlechat) > 0 {
		response = append(response, "googlechat")
	}
	if len(s.Kafka) > 0 {
		response = append(response, "kafka")
	}
	if len(s.Line) > 0 {
		response = append(response, "line")
	}
	if len(s.Opsgenie) > 0 {
		response = append(response, "opsgenie")
	}
	if len(s.Pagerduty) > 0 {
		response = append(response, "pagerduty")
	}
	if len(s.Pushover) > 0 {
		response = append(response, "pushover")
	}
	if len(s.Sensugo) > 0 {
		response = append(response, "sensu")
	}
	if len(s.Slack) > 0 {
		response = append(response, "slack")
	}
	if len(s.Teams) > 0 {
		response = append(response, "teams")
	}
	if len(s.Telegram) > 0 {
		response = append(response, "telegram")
	}
	if len(s.Threema) > 0 {
		response = append(response, "threema")
	}
	if len(s.Victorops) > 0 {
		response = append(response, "victorops")
	}
	if len(s.Webhook) > 0 {
		response = append(response, "webhook")
	}
	if len(s.Wecom) > 0 {
		response = append(response, "wecom")
	}
	return response
}

func (s *Spec) IntegrationsCount() int {
	return len(s.Alertmanager) + len(s.Dingding) + len(s.Discord) + len(s.Email) +
		len(s.Googlechat) + len(s.Kafka) + len(s.Line) + len(s.Opsgenie) +
		len(s.Pagerduty) + len(s.Oncall) + len(s.Pushover) + len(s.Sensugo) +
		len(s.Sns) + len(s.Slack) + len(s.Teams) + len(s.Telegram) +
		len(s.Threema) + len(s.Victorops) + len(s.Webhook) + len(s.Wecom) +
		len(s.Webex) + len(s.Mqtt)
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
