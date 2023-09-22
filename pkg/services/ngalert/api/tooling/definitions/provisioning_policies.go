package definitions

import (
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/common/model"
)

// swagger:route GET /api/v1/provisioning/policies provisioning stable RouteGetPolicyTree
//
// Get the notification policy tree.
//
//     Responses:
//       200: Route
//         description: The currently active notification routing tree

// swagger:route PUT /api/v1/provisioning/policies provisioning stable RoutePutPolicyTree
//
// Sets the notification policy tree.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack
//       400: ValidationError

// swagger:route DELETE /api/v1/provisioning/policies provisioning stable RouteResetPolicyTree
//
// Clears the notification policy tree.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack

// swagger:route GET /api/v1/provisioning/policies/export provisioning stable RouteGetPolicyTreeExport
//
// Export the notification policy tree in provisioning file format.
//
//     Responses:
//       200: AlertingFileExport
//       404: NotFound

// swagger:parameters RoutePutPolicyTree
type Policytree struct {
	// The new notification routing tree to use
	// in:body
	Body Route
}

// NotificationPolicyExport is the provisioned file export of alerting.NotificiationPolicyV1.
type NotificationPolicyExport struct {
	OrgID  int64        `json:"orgId" yaml:"orgId"`
	Policy *RouteExport `json:",inline" yaml:",inline"`
}

// RouteExport is the provisioned file export of definitions.Route. This is needed to hide fields that aren't useable in
// provisioning file format. An alternative would be to define a custom MarshalJSON and MarshalYAML that excludes them.
type RouteExport struct {
	Receiver string `yaml:"receiver,omitempty" json:"receiver,omitempty"`

	GroupByStr []string `yaml:"group_by,omitempty" json:"group_by,omitempty"`
	// Deprecated. Remove before v1.0 release.
	Match map[string]string `yaml:"match,omitempty" json:"match,omitempty"`
	// Deprecated. Remove before v1.0 release.
	MatchRE           config.MatchRegexps `yaml:"match_re,omitempty" json:"match_re,omitempty"`
	Matchers          config.Matchers     `yaml:"matchers,omitempty" json:"matchers,omitempty"`
	ObjectMatchers    ObjectMatchers      `yaml:"object_matchers,omitempty" json:"object_matchers,omitempty"`
	MuteTimeIntervals []string            `yaml:"mute_time_intervals,omitempty" json:"mute_time_intervals,omitempty"`
	Continue          bool                `yaml:"continue,omitempty" json:"continue,omitempty"` // Added omitempty to yaml for a cleaner export.
	Routes            []*RouteExport      `yaml:"routes,omitempty" json:"routes,omitempty"`

	GroupWait      *model.Duration `yaml:"group_wait,omitempty" json:"group_wait,omitempty"`
	GroupInterval  *model.Duration `yaml:"group_interval,omitempty" json:"group_interval,omitempty"`
	RepeatInterval *model.Duration `yaml:"repeat_interval,omitempty" json:"repeat_interval,omitempty"`
}
