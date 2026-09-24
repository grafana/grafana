package v0alpha1

// TeamLBACRuleConditionTypeEnforceable reports whether the stored rule can
// currently be applied to datasource queries.
const TeamLBACRuleConditionTypeEnforceable = "Enforceable"

const (
	// TeamLBACRuleConditionReasonReady accompanies an Enforceable=True condition.
	TeamLBACRuleConditionReasonReady = "Ready"
	// TeamLBACRuleConditionReasonBasicAuthDisabled accompanies Enforceable=False.
	// It takes precedence over BasicAuthUserMissing when Basic Auth is disabled
	// and its username is empty.
	TeamLBACRuleConditionReasonBasicAuthDisabled = "BasicAuthDisabled"
	// TeamLBACRuleConditionReasonBasicAuthUserMissing accompanies Enforceable=False.
	TeamLBACRuleConditionReasonBasicAuthUserMissing = "BasicAuthUserMissing"
	// TeamLBACRuleConditionReasonDatasourceNotFound accompanies Enforceable=False.
	TeamLBACRuleConditionReasonDatasourceNotFound = "DatasourceNotFound"
	// TeamLBACRuleConditionReasonDatasourceLookupFailed accompanies Enforceable=Unknown.
	TeamLBACRuleConditionReasonDatasourceLookupFailed = "DatasourceLookupFailed"
	// TeamLBACRuleConditionReasonNamespaceResolutionFailed accompanies Enforceable=Unknown.
	TeamLBACRuleConditionReasonNamespaceResolutionFailed = "NamespaceResolutionFailed"
	// TeamLBACRuleConditionReasonUnsupportedDatasourceType accompanies Enforceable=False.
	TeamLBACRuleConditionReasonUnsupportedDatasourceType = "UnsupportedDatasourceType"
)
