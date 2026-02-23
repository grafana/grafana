package definitions

import (
	"github.com/prometheus/alertmanager/config"
)

// swagger:route GET /v1/provisioning/policies provisioning stable RouteGetPolicyTree
//
// Get the notification policy tree.
//
//     Responses:
//       200: Route
//         description: The currently active notification routing tree

// swagger:route PUT /v1/provisioning/policies provisioning stable RoutePutPolicyTree
//
// Sets the notification policy tree.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack
//       400: ValidationError

// swagger:route DELETE /v1/provisioning/policies provisioning stable RouteResetPolicyTree
//
// Clears the notification policy tree.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       202: Ack

// swagger:route GET /v1/provisioning/policies/export provisioning stable RouteGetPolicyTreeExport
//
// Export the notification policy tree in provisioning file format.
//
//     Produces:
//     - application/json
//     - application/yaml
//     - application/terraform+hcl
//     - text/yaml
//     - text/hcl
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

// swagger:parameters RoutePutPolicyTree
type PolicyTreeHeaders struct {
	// in:header
	XDisableProvenance string `json:"X-Disable-Provenance"`
}

// NotificationPolicyExport is the provisioned file export of alerting.NotificiationPolicyV1.
type NotificationPolicyExport struct {
	OrgID        int64 `json:"orgId" yaml:"orgId"`
	*RouteExport `yaml:",inline"`
}

// RouteExport is the provisioned file export of definitions.Route. This is needed to hide fields that aren't useable in
// provisioning file format. An alternative would be to define a custom MarshalJSON and MarshalYAML that excludes them.
type RouteExport struct {
	Receiver string `yaml:"receiver,omitempty" json:"receiver,omitempty" hcl:"contact_point"`

	GroupByStr *[]string `yaml:"group_by,omitempty" json:"group_by,omitempty" hcl:"group_by"`
	// Deprecated. Remove before v1.0 release.
	Match map[string]string `yaml:"match,omitempty" json:"match,omitempty"`
	// Deprecated. Remove before v1.0 release.
	MatchRE             config.MatchRegexps `yaml:"match_re,omitempty" json:"match_re,omitempty"`
	Matchers            config.Matchers     `yaml:"matchers,omitempty" json:"matchers,omitempty"`
	ObjectMatchers      ObjectMatchers      `yaml:"object_matchers,omitempty" json:"object_matchers,omitempty"`
	ObjectMatchersSlice []*MatcherExport    `yaml:"-" json:"-" hcl:"matcher,block"`
	MuteTimeIntervals   *[]string           `yaml:"mute_time_intervals,omitempty" json:"mute_time_intervals,omitempty" hcl:"mute_timings"`
	ActiveTimeIntervals *[]string           `yaml:"active_time_intervals,omitempty" json:"active_time_intervals,omitempty" hcl:"active_timings"`
	Continue            *bool               `yaml:"continue,omitempty" json:"continue,omitempty" hcl:"continue,optional"` // Added omitempty to yaml for a cleaner export.
	Routes              []*RouteExport      `yaml:"routes,omitempty" json:"routes,omitempty" hcl:"policy,block"`

	GroupWait      *string `yaml:"group_wait,omitempty" json:"group_wait,omitempty" hcl:"group_wait,optional"`
	GroupInterval  *string `yaml:"group_interval,omitempty" json:"group_interval,omitempty" hcl:"group_interval,optional"`
	RepeatInterval *string `yaml:"repeat_interval,omitempty" json:"repeat_interval,omitempty" hcl:"repeat_interval,optional"`
}

type MatcherExport struct {
	Label string `yaml:"-" json:"-" hcl:"label"`
	Match string `yaml:"-" json:"-" hcl:"match"`
	Value string `yaml:"-" json:"-" hcl:"value"`
}
