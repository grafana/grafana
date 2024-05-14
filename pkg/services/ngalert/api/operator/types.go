package operator

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type Metadata struct {
	Name string `json:"name"`
}

// GrafanaAlertRuleGroupSpec defines the desired state of GrafanaAlertRuleGroup
type GrafanaAlertRuleGroupSpec struct {
	ResyncPeriod              metav1.Duration               `json:"resyncPeriod,omitempty"`
	InstanceSelector          *metav1.LabelSelector         `json:"instanceSelector"`
	FolderUID                 string                        `json:"folderUID,omitempty"`
	FolderRef                 string                        `json:"folderRef,omitempty"`
	Rules                     []definitions.AlertRuleExport `json:"rules"`
	Interval                  metav1.Duration               `json:"interval"`
	AllowCrossNamespaceImport *bool                         `json:"allowCrossNamespaceImport,omitempty"`
}

// GrafanaAlertRuleGroup is the Schema for the grafanaalertrulegroups API
type GrafanaAlertRuleGroup struct {
	metav1.TypeMeta `json:",inline"`
	Metadata        `json:"metadata,omitempty"`

	Spec GrafanaAlertRuleGroupSpec `json:"spec,omitempty"`
}

func BuildAlertRuleGroup(idx int, body definitions.AlertRuleGroupExport) GrafanaAlertRuleGroup {
	return GrafanaAlertRuleGroup{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "grafana.integreatly.org/v1beta1",
			Kind:       "GrafanaAlertRuleGroup",
		},
		Metadata: Metadata{
			Name: fmt.Sprintf("alert-rule-group-%04d", idx),
		},
		Spec: GrafanaAlertRuleGroupSpec{
			InstanceSelector: &metav1.LabelSelector{},
			FolderUID:        body.FolderUID,
			Rules:            body.Rules,
			Interval: metav1.Duration{
				Duration: time.Duration(body.IntervalSeconds * int64(time.Second)),
			},
		},
	}
}

// GrafanaContactPointSpec defines the desired state of GrafanaContactPoint
type GrafanaContactPointSpec struct {
	InstanceSelector      *metav1.LabelSelector  `json:"instanceSelector"`
	DisableResolveMessage bool                   `json:"disableResolveMessage,omitempty"`
	Name                  string                 `json:"name"`
	Settings              definitions.RawMessage `json:"settings"`
	Type                  string                 `json:"type,omitempty"`
}

// GrafanaContactPoint is the Schema for the grafanacontactpoints API
type GrafanaContactPoint struct {
	metav1.TypeMeta `json:",inline"`
	Metadata        `json:"metadata,omitempty"`

	Spec GrafanaContactPointSpec `json:"spec,omitempty"`
}

func BuildContactPoints(idx int, body definitions.ContactPointExport) []GrafanaContactPoint {
	out := []GrafanaContactPoint{}
	for ridx, receiver := range body.Receivers {
		out = append(out, GrafanaContactPoint{
			TypeMeta: metav1.TypeMeta{
				APIVersion: "grafana.integreatly.org/v1beta1",
				Kind:       "GrafanaContactPoint",
			},
			Metadata: Metadata{
				Name: fmt.Sprintf("contact-point-%04d-%02d", idx, ridx),
			},
			Spec: GrafanaContactPointSpec{
				InstanceSelector:      &metav1.LabelSelector{},
				DisableResolveMessage: receiver.DisableResolveMessage,
				Type:                  receiver.Type,
				Name:                  fmt.Sprintf("%s receiver %02d", body.Name, ridx),
				Settings:              receiver.Settings,
			},
		})
	}
	return out
}
