package app

import (
	"github.com/grafana/grafana-app-sdk/k8s"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/convert"
)

// ruleConverter converts AlertRule, RecordingRule and RuleSequence between
// v0alpha1 and v1beta1 for the apiserver. See package convert.
type ruleConverter struct{}

func (ruleConverter) Convert(obj k8s.RawKind, targetAPIVersion string) ([]byte, error) {
	return convert.Raw(obj.Raw, obj.Kind, targetAPIVersion)
}
