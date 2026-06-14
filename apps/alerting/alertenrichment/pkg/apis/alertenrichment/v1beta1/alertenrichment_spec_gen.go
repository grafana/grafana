// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// Matcher is used to match label (or annotation) values.
// +k8s:openapi-gen=true
type AlertEnrichmentMatcher struct {
	// Comparison operator
	Type  AlertEnrichmentMatcherType `json:"type"`
	Name  string                     `json:"name"`
	Value string                     `json:"value"`
}

// NewAlertEnrichmentMatcher creates a new AlertEnrichmentMatcher object.
func NewAlertEnrichmentMatcher() *AlertEnrichmentMatcher {
	return &AlertEnrichmentMatcher{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentMatcher.
func (AlertEnrichmentMatcher) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentMatcher"
}

// Step represent an invocation of a single enricher.
// +k8s:openapi-gen=true
type AlertEnrichmentStep struct {
	// Step kind: 'enricher' or 'conditional'
	Type AlertEnrichmentStepType `json:"type"`
	// Timeout is the maximum about of time this specific enrichment is allowed to take.
	// Accepts a Go duration string (e.g. "5s", "1m30s", "500ms").
	Timeout string `json:"timeout"`
	// Enricher specifies what enricher to run and it's configuration.
	Enricher *AlertEnrichmentEnricherConfig `json:"enricher,omitempty"`
	// Conditional allows branching to specifies what enricher to run and it's configuration.
	Conditional *AlertEnrichmentConditional `json:"conditional,omitempty"`
}

// NewAlertEnrichmentStep creates a new AlertEnrichmentStep object.
func NewAlertEnrichmentStep() *AlertEnrichmentStep {
	return &AlertEnrichmentStep{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentStep.
func (AlertEnrichmentStep) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentStep"
}

// EnricherConfig is a discriminated union of enricher configurations.
// +k8s:openapi-gen=true
type AlertEnrichmentEnricherConfig struct {
	// Enricher type
	Type        AlertEnrichmentEnricherConfigType   `json:"type"`
	Assign      *AlertEnrichmentAssignEnricher      `json:"assign,omitempty"`
	External    *AlertEnrichmentExternalEnricher    `json:"external,omitempty"`
	DataSource  *AlertEnrichmentDataSourceEnricher  `json:"dataSource,omitempty"`
	Sift        *AlertEnrichmentSiftEnricher        `json:"sift,omitempty"`
	Asserts     *AlertEnrichmentAssertsEnricher     `json:"asserts,omitempty"`
	Explain     *AlertEnrichmentExplainEnricher     `json:"explain,omitempty"`
	Loop        *AlertEnrichmentLoopEnricher        `json:"loop,omitempty"`
	Assistant   *AlertEnrichmentAssistantEnricher   `json:"assistant,omitempty"`
	QuerySample *AlertEnrichmentQuerySampleEnricher `json:"querySample,omitempty"`
}

// NewAlertEnrichmentEnricherConfig creates a new AlertEnrichmentEnricherConfig object.
func NewAlertEnrichmentEnricherConfig() *AlertEnrichmentEnricherConfig {
	return &AlertEnrichmentEnricherConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentEnricherConfig.
func (AlertEnrichmentEnricherConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentEnricherConfig"
}

// AssignEnricher configures an enricher which assigns annotations.
// +k8s:openapi-gen=true
type AlertEnrichmentAssignEnricher struct {
	// Annotations to change and values to set them to.
	Annotations []AlertEnrichmentAssignment `json:"annotations"`
}

// NewAlertEnrichmentAssignEnricher creates a new AlertEnrichmentAssignEnricher object.
func NewAlertEnrichmentAssignEnricher() *AlertEnrichmentAssignEnricher {
	return &AlertEnrichmentAssignEnricher{
		Annotations: []AlertEnrichmentAssignment{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentAssignEnricher.
func (AlertEnrichmentAssignEnricher) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentAssignEnricher"
}

// +k8s:openapi-gen=true
type AlertEnrichmentAssignment struct {
	// Name of the annotation to assign.
	Name string `json:"name"`
	// Value to assign to the annotation. Can use Go template format, with access to
	// annotations and labels via e.g. {{$annotations.x}}
	Value string `json:"value"`
}

// NewAlertEnrichmentAssignment creates a new AlertEnrichmentAssignment object.
func NewAlertEnrichmentAssignment() *AlertEnrichmentAssignment {
	return &AlertEnrichmentAssignment{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentAssignment.
func (AlertEnrichmentAssignment) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentAssignment"
}

// ExternalEnricher configures an enricher which calls an external service.
// +k8s:openapi-gen=true
type AlertEnrichmentExternalEnricher struct {
	// URL of the external HTTP service to call out to.
	Url string `json:"url"`
}

// NewAlertEnrichmentExternalEnricher creates a new AlertEnrichmentExternalEnricher object.
func NewAlertEnrichmentExternalEnricher() *AlertEnrichmentExternalEnricher {
	return &AlertEnrichmentExternalEnricher{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentExternalEnricher.
func (AlertEnrichmentExternalEnricher) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentExternalEnricher"
}

// DataSourceEnricher configures an enricher which calls an external service.
// +k8s:openapi-gen=true
type AlertEnrichmentDataSourceEnricher struct {
	// Data source query type
	Type AlertEnrichmentDataSourceEnricherType `json:"type"`
	Raw  *AlertEnrichmentRawDataSourceQuery    `json:"raw,omitempty"`
	Logs *AlertEnrichmentLogsDataSourceQuery   `json:"logs,omitempty"`
}

// NewAlertEnrichmentDataSourceEnricher creates a new AlertEnrichmentDataSourceEnricher object.
func NewAlertEnrichmentDataSourceEnricher() *AlertEnrichmentDataSourceEnricher {
	return &AlertEnrichmentDataSourceEnricher{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentDataSourceEnricher.
func (AlertEnrichmentDataSourceEnricher) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentDataSourceEnricher"
}

// RawDataSourceQuery allows defining the entire query request
// +k8s:openapi-gen=true
type AlertEnrichmentRawDataSourceQuery struct {
	// The data source request to perform.
	Request map[string]interface{} `json:"request,omitempty"`
	// The RefID of the response to use. Not required if only a single query is given.
	RefId *string `json:"refId,omitempty"`
}

// NewAlertEnrichmentRawDataSourceQuery creates a new AlertEnrichmentRawDataSourceQuery object.
func NewAlertEnrichmentRawDataSourceQuery() *AlertEnrichmentRawDataSourceQuery {
	return &AlertEnrichmentRawDataSourceQuery{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentRawDataSourceQuery.
func (AlertEnrichmentRawDataSourceQuery) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentRawDataSourceQuery"
}

// LogsDataSourceQuery is a simplified method of describing a logs query,
// typically those that return data frames with a "Line" field.
// +k8s:openapi-gen=true
type AlertEnrichmentLogsDataSourceQuery struct {
	// The datasource plugin type
	DataSourceType string `json:"dataSourceType"`
	// Datasource UID
	DataSourceUid *string `json:"dataSourceUid,omitempty"`
	// The logs query to run.
	Expr string `json:"expr"`
	// Number of log lines to add to the alert. Defaults to 3.
	MaxLines *int64 `json:"maxLines,omitempty"`
}

// NewAlertEnrichmentLogsDataSourceQuery creates a new AlertEnrichmentLogsDataSourceQuery object.
func NewAlertEnrichmentLogsDataSourceQuery() *AlertEnrichmentLogsDataSourceQuery {
	return &AlertEnrichmentLogsDataSourceQuery{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentLogsDataSourceQuery.
func (AlertEnrichmentLogsDataSourceQuery) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentLogsDataSourceQuery"
}

// SiftEnricher configures an enricher which calls into Sift.
// +k8s:openapi-gen=true
type AlertEnrichmentSiftEnricher interface{}

// AssertsEnricher configures an enricher which calls into Asserts.
// +k8s:openapi-gen=true
type AlertEnrichmentAssertsEnricher interface{}

// ExplainEnricher uses LLM to generate explanations for alerts.
// +k8s:openapi-gen=true
type AlertEnrichmentExplainEnricher struct {
	Annotation string `json:"annotation"`
}

// NewAlertEnrichmentExplainEnricher creates a new AlertEnrichmentExplainEnricher object.
func NewAlertEnrichmentExplainEnricher() *AlertEnrichmentExplainEnricher {
	return &AlertEnrichmentExplainEnricher{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentExplainEnricher.
func (AlertEnrichmentExplainEnricher) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentExplainEnricher"
}

// LoopEnricher configures an enricher which calls into Loop.
// +k8s:openapi-gen=true
type AlertEnrichmentLoopEnricher interface{}

// AssistantEnricher configures an enricher which calls into Assistant.
// +k8s:openapi-gen=true
type AlertEnrichmentAssistantEnricher interface{}

// QuerySampleEnricher configures an enricher that samples data from the queries
// used in the alert rule definition, such as logs.
// +k8s:openapi-gen=true
type AlertEnrichmentQuerySampleEnricher interface{}

// +k8s:openapi-gen=true
type AlertEnrichmentConditional struct {
	// If is the condition to evaluate.
	If AlertEnrichmentCondition `json:"if"`
	// Then is the enrichment steps to perform if all the conditions above are true.
	Then []AlertEnrichmentStep `json:"then"`
	// Else is the enrichment steps to perform otherwise.
	Else []AlertEnrichmentStep `json:"else,omitempty"`
}

// NewAlertEnrichmentConditional creates a new AlertEnrichmentConditional object.
func NewAlertEnrichmentConditional() *AlertEnrichmentConditional {
	return &AlertEnrichmentConditional{
		If:   *NewAlertEnrichmentCondition(),
		Then: []AlertEnrichmentStep{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentConditional.
func (AlertEnrichmentConditional) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentConditional"
}

// +k8s:openapi-gen=true
type AlertEnrichmentCondition struct {
	// LabelMatchers optionally specifies the condition to require matching label values.
	LabelMatchers []AlertEnrichmentMatcher `json:"labelMatchers,omitempty"`
	// AnnotationMatchers optionally restricts when the per-alert enrichments are run.
	AnnotationMatchers []AlertEnrichmentMatcher `json:"annotationMatchers,omitempty"`
	// DataSourceQuery is a data source query to run. If the query returns a non-zero value,
	// then the condition is taken to be true.
	DataSourceQuery *AlertEnrichmentRawDataSourceQuery `json:"dataSourceQuery,omitempty"`
}

// NewAlertEnrichmentCondition creates a new AlertEnrichmentCondition object.
func NewAlertEnrichmentCondition() *AlertEnrichmentCondition {
	return &AlertEnrichmentCondition{}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentCondition.
func (AlertEnrichmentCondition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentCondition"
}

// +k8s:openapi-gen=true
type AlertEnrichmentSpec struct {
	// Title of the alert enrichment.
	Title string `json:"title"`
	// Description of the alert enrichment.
	Description *string `json:"description,omitempty"`
	// Alert rules for which to run the enrichment for.
	// If not set, the enrichment runs for all alert rules.
	AlertRuleUids []string `json:"alertRuleUids,omitempty"`
	// LabelMatchers optionally restricts when this enrichment runs.
	LabelMatchers []AlertEnrichmentMatcher `json:"labelMatchers,omitempty"`
	// AnnotationMatchers optionally restricts when this enrichment runs.
	AnnotationMatchers []AlertEnrichmentMatcher `json:"annotationMatchers,omitempty"`
	// Receivers optionally restricts the enrichment to one or more receiver names.
	// If not set, the enrichment runs for alerts coming from all receivers.
	Receivers []string `json:"receivers,omitempty"`
	// Steps of the enrichment pipeline.
	Steps []AlertEnrichmentStep `json:"steps"`
}

// NewAlertEnrichmentSpec creates a new AlertEnrichmentSpec object.
func NewAlertEnrichmentSpec() *AlertEnrichmentSpec {
	return &AlertEnrichmentSpec{
		Steps: []AlertEnrichmentStep{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentSpec.
func (AlertEnrichmentSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentSpec"
}

// +k8s:openapi-gen=true
type AlertEnrichmentMatcherType string

const (
	AlertEnrichmentMatcherTypeEqual         AlertEnrichmentMatcherType = "="
	AlertEnrichmentMatcherTypeNotEqual      AlertEnrichmentMatcherType = "!="
	AlertEnrichmentMatcherTypeEqualRegex    AlertEnrichmentMatcherType = "=~"
	AlertEnrichmentMatcherTypeNotEqualRegex AlertEnrichmentMatcherType = "!~"
)

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentMatcherType.
func (AlertEnrichmentMatcherType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentMatcherType"
}

// +k8s:openapi-gen=true
type AlertEnrichmentStepType string

const (
	AlertEnrichmentStepTypeEnricher    AlertEnrichmentStepType = "enricher"
	AlertEnrichmentStepTypeConditional AlertEnrichmentStepType = "conditional"
)

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentStepType.
func (AlertEnrichmentStepType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentStepType"
}

// +k8s:openapi-gen=true
type AlertEnrichmentEnricherConfigType string

const (
	AlertEnrichmentEnricherConfigTypeAssign      AlertEnrichmentEnricherConfigType = "assign"
	AlertEnrichmentEnricherConfigTypeExternal    AlertEnrichmentEnricherConfigType = "external"
	AlertEnrichmentEnricherConfigTypeDsquery     AlertEnrichmentEnricherConfigType = "dsquery"
	AlertEnrichmentEnricherConfigTypeSift        AlertEnrichmentEnricherConfigType = "sift"
	AlertEnrichmentEnricherConfigTypeAsserts     AlertEnrichmentEnricherConfigType = "asserts"
	AlertEnrichmentEnricherConfigTypeExplain     AlertEnrichmentEnricherConfigType = "explain"
	AlertEnrichmentEnricherConfigTypeLoop        AlertEnrichmentEnricherConfigType = "loop"
	AlertEnrichmentEnricherConfigTypeAssistant   AlertEnrichmentEnricherConfigType = "assistant"
	AlertEnrichmentEnricherConfigTypeQuerySample AlertEnrichmentEnricherConfigType = "querySample"
)

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentEnricherConfigType.
func (AlertEnrichmentEnricherConfigType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentEnricherConfigType"
}

// +k8s:openapi-gen=true
type AlertEnrichmentDataSourceEnricherType string

const (
	AlertEnrichmentDataSourceEnricherTypeRaw  AlertEnrichmentDataSourceEnricherType = "raw"
	AlertEnrichmentDataSourceEnricherTypeLogs AlertEnrichmentDataSourceEnricherType = "logs"
)

// OpenAPIModelName returns the OpenAPI model name for AlertEnrichmentDataSourceEnricherType.
func (AlertEnrichmentDataSourceEnricherType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.alerting.alertenrichment.pkg.apis.alertenrichment.v1beta1.AlertEnrichmentDataSourceEnricherType"
}
