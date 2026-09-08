package kinds

import (
	"github.com/grafana/grafana/apps/alerting/rules/kinds/v0alpha1"
)

alertRuleKind: {
	kind:       "AlertRule"
	pluralName: "AlertRules"
}

alertRulev0alpha1: alertRuleKind & {
	schema: {
		spec: v0alpha1.#AlertRuleSpec
	}
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
			"DELETE",
		]
	}
	mutation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	selectableFields: [
		"spec.title",
		"spec.paused",
		"spec.panelRef.dashboardUID",
		"spec.panelRef.panelID",
		"spec.notificationSettings.type",
		"spec.notificationSettings.receiver",
		"spec.notificationSettings.routingTree",
		// TODO: add status fields for filtering
	]

	// searchFields drive the unified-storage search index for alert rules.
	// Fields with a path are read directly from the resource by the standard
	// document builder; fields without a path are computed by the alert-rule
	// document builder (see pkg/storage/unified/search/builders/alertingrules.go)
	// because they cannot be expressed as a single JSON path: type is a constant
	// per kind, labels and annotations are maps (the path extractor has no map
	// support), and datasourceUIDs must exclude server-side expression
	// datasources and deduplicate across the expression map. type and
	// capabilities are still declared for computed fields so they drive the
	// bleve mapping.
	//
	// The notificationSettings union serializes flat: a "type" discriminator
	// plus the active branch's fields (receiver for SimplifiedRouting,
	// routingTree for NamedRoutingTree) at the same level, so all three read
	// from spec.notificationSettings.* directly.
	searchFields: [
		{
			name: "type"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The rule type discriminator (always \"alertrule\")"
		},
		{
			name: "interval"
			path: "spec.trigger.interval"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The evaluation interval of the rule"
		},
		{
			name: "paused"
			path: "spec.paused"
			type: "boolean"
			capabilities: ["filter", "retrieve"]
			description: "Whether the rule is paused"
		},
		{
			name:  "labels"
			type:  "string"
			array: true
			capabilities: ["filter", "retrieve"]
			description: "The rule's labels, flattened to key and key=value terms"
		},
		{
			name: "annotations"
			type: "string"
			capabilities: ["retrieve"]
			description: "The rule's annotations, JSON-encoded for display"
		},
		{
			name: "for"
			path: "spec.for"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "How long the condition must be met before the rule fires"
		},
		{
			name: "keepFiringFor"
			path: "spec.keepFiringFor"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "How long the rule keeps firing after the condition clears"
		},
		{
			name:  "datasourceUIDs"
			type:  "string"
			array: true
			capabilities: ["filter", "retrieve"]
			description: "The query datasource UIDs referenced by the rule's expressions"
		},
		{
			name: "dashboardUID"
			path: "spec.panelRef.dashboardUID"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The UID of the dashboard the rule is associated with"
		},
		{
			name: "panelID"
			path: "spec.panelRef.panelID"
			type: "int64"
			capabilities: ["filter", "retrieve"]
			description: "The ID of the panel the rule is associated with"
		},
		{
			name: "receiver"
			path: "spec.notificationSettings.receiver"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The receiver for simplified-routing notification settings"
		},
		{
			name: "notificationType"
			path: "spec.notificationSettings.type"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "Which notification routing branch is configured"
		},
		{
			name: "routingTree"
			path: "spec.notificationSettings.routingTree"
			type: "string"
			capabilities: ["filter", "retrieve"]
			description: "The named routing tree for the rule's notifications"
		},
	]
}
