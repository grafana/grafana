package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// JSONSchema descriptions help the enrichment suggest API to generate enrichment configurations.

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AlertEnrichment struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec AlertEnrichmentSpec `json:"spec,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AlertEnrichmentList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []AlertEnrichment `json:"items,omitempty"`
}

// AlertEnrichmentSpec specifies an alert enrichment pipeline.
type AlertEnrichmentSpec struct {
	// Title of the alert enrichment.
	// +kubebuilder:validation:Required
	Title string `json:"title" yaml:"title" jsonschema:"description=Title of the alert enrichment"`

	// Description of the alert enrichment.
	Description string `json:"description,omitempty" yaml:"description,omitempty" jsonschema:"description=Human‑readable description"`

	// Alert rules for which to run the enrichment for.
	// If not set, the enrichment runs for all alert rules.
	// +listType=set
	AlertRuleUIDs []string `json:"alertRuleUids,omitempty" yaml:"alertRuleUids,omitempty" jsonschema:"description=UIDs of alert rules this enrichment applies to (empty = all)"`

	// LabelMatchers optionally restricts when this enrichment runs.
	LabelMatchers []Matcher `json:"labelMatchers,omitempty" yaml:"labelMatchers,omitempty" jsonschema:"description=Label matchers that must be satisfied by the alert for this enrichment to run"`

	// AnnotationMatchers optionally restricts when this enrichment runs.
	AnnotationMatchers []Matcher `json:"annotationMatchers,omitempty" yaml:"annotationMatchers,omitempty" jsonschema:"description=Annotation matchers that must be satisfied by the alert for this enrichment to run"`

	// Receivers optionally restricts the enrichment to one or more receiver names.
	// If not set, the enrichment runs for alerts coming from all receivers.
	// +listType=set
	Receivers []string `json:"receivers,omitempty" yaml:"receivers,omitempty" jsonschema:"description=Alertmanager receiver names to match (empty = all)"`

	// Steps of the enrichment pipeline.
	Steps []Step `json:"steps" yaml:"steps" jsonschema:"description=Ordered list of enricher steps"`
}

// Type of comparison performed by the matcher. This mimics Alertmanager matchers.
// +enum
type StepType string

// Defines values for MatchType.
const (
	StepTypeEnricher    StepType = "enricher"
	StepTypeConditional StepType = "conditional"
)

// Step represent an invocation of a single enricher.
type Step struct {
	Type StepType `json:"type" yaml:"type" jsonschema:"description=Step kind: 'enricher' or 'conditional'"`

	// Timeout is the maximum about of time this specific enrichment is allowed to take.
	Timeout metav1.Duration `json:"timeout" yaml:"timeout" jsonschema:"description=Maximum execution duration for this step, for example '5s'"`

	// Enricher specifies what enricher to run and it's configuration.
	Enricher *EnricherConfig `json:"enricher,omitempty" yaml:"enricher,omitempty" jsonschema:"description=Enricher configuration"`

	// Conditional allows branching to specifies what enricher to run and it's configuration.
	Conditional *Conditional `json:"conditional,omitempty" yaml:"conditional,omitempty" jsonschema:"description=Conditional enricher configuration that branches based on the condition"`
}

type Conditional struct {
	// If is the condition to evaluate.
	If Condition `json:"if" yaml:"if" jsonschema:"description=Condition to evaluate before running the enrichment steps"`

	// Then is the enrichment steps to perform if all the conditions above are true.
	Then []Step `json:"then" yaml:"then" jsonschema:"description=Steps executed when the condition is true"`

	// Else is the enrichment steps to perform otherwise.
	Else []Step `json:"else,omitempty" yaml:"else,omitempty" jsonschema:"description=Steps executed when the condition is false"`
}

type Condition struct {
	// LabelMatchers optionally specifies the condition to require matching label values.
	LabelMatchers []Matcher `json:"labelMatchers,omitempty" yaml:"labelMatchers,omitempty" jsonschema:"description=Label matchers that must be satisfied"`

	// AnnotationMatchers optionally restricts when the per-alert enrichments are run.
	AnnotationMatchers []Matcher `json:"annotationMatchers,omitempty" yaml:"annotationMatchers,omitempty" jsonschema:"description=Annotation matchers that must be satisfied"`

	// DataSourceQuery is a data source query to run. If the query returns a non-zero value,
	// then the condition is taken to be true.
	DataSourceQuery *RawDataSourceQuery `json:"dataSourceQuery,omitempty" yaml:"dataSourceQuery,omitempty" jsonschema:"description=Data source query to run to evaluate the condition"`
}

// Matcher is used to match label (or annotation) values.
type Matcher struct {
	Type  MatchType `json:"type" yaml:"type" jsonschema:"description=Comparison operator ('=', '!=', '=~', '!~')"`
	Name  string    `json:"name" yaml:"name" jsonschema:"description=Label/annotation key"`
	Value string    `json:"value" yaml:"value" jsonschema:"description=Value or regex pattern to match"`
}

// Type of comparison performed by the matcher. This mimics Alertmanager matchers.
// +enum
type MatchType string

// Defines values for MatchType.
const (
	MatchTypeEqual    MatchType = "="
	MatchTypeNotEqual MatchType = "!="
	MatchTypeRegexp   MatchType = "=~"
	MatchNotRegexp    MatchType = "!~"
)

// Type of enricher
// +enum
type EnricherType string

// Defines values for EnricherType.
const (
	EnricherTypeAssign          EnricherType = "assign"
	EnricherTypeExternal        EnricherType = "external"
	EnricherTypeDataSourceQuery EnricherType = "dsquery"
	EnricherTypeSift            EnricherType = "sift"
	EnricherTypeAsserts         EnricherType = "asserts"
	EnricherTypeExplain         EnricherType = "explain"
	EnricherTypeLoop            EnricherType = "loop"
)

// EnricherConfig is a discriminated union of enricher configurations.
type EnricherConfig struct {
	Type EnricherType `json:"type" yaml:"type" jsonschema:"description=Enricher type ('assign', 'external', 'dsquery', 'sift', 'asserts', 'explain', 'loop')"`

	Assign     *AssignEnricher     `json:"assign,omitempty" yaml:"assign,omitempty" jsonschema:"description=Assign enricher settings"`
	External   *ExternalEnricher   `json:"external,omitempty" yaml:"external,omitempty" jsonschema:"description=External HTTP enricher settings"`
	DataSource *DataSourceEnricher `json:"dataSource,omitempty" yaml:"dataSource,omitempty" jsonschema:"description=Data source query enricher settings"`
	Sift       *SiftEnricher       `json:"sift,omitempty" yaml:"sift,omitempty" jsonschema:"description=Sift enricher settings"`
	Asserts    *AssertsEnricher    `json:"asserts,omitempty" yaml:"asserts,omitempty" jsonschema:"description=Asserts enricher settings"`
	Explain    *ExplainEnricher    `json:"explain,omitempty" yaml:"explain,omitempty" jsonschema:"description=Explain enricher settings"`
	Loop       *LoopEnricher       `json:"loop,omitempty" yaml:"loop,omitempty" jsonschema:"description=Loop enricher settings"`
}

// AssignEnricher configures an enricher which assigns annotations.
type AssignEnricher struct {
	// Annotations to change and values to set them to.
	// +listType=map
	// +listMapKey=name
	Annotations []Assignment `json:"annotations" yaml:"annotations" jsonschema:"description=Annotations to set on the alert"`
}

type Assignment struct {
	// Name of the annotation to assign.
	Name string `json:"name" yaml:"name" jsonschema:"description=Annotation key"`
	// Value to assign to the annotation. Can use Go template format, with access to
	// annotations and labels via e.g. {{$annotations.x}}
	Value string `json:"value" yaml:"value" jsonschema:"description=Template value to apply, for example '{{ $labels.instance }} is down'"`
}

// ExternalEnricher configures an enricher which calls an external service.
type ExternalEnricher struct {
	// URL of the external HTTP service to call out to.
	URL string `json:"url" yaml:"url" jsonschema:"description=HTTP endpoint to call for enrichment"`
}

// Type of data source query
// +enum
type DataSourceQueryType string

// Defines values for EnricherType.
const (
	DataSourceQueryTypeRaw  DataSourceQueryType = "raw"
	DataSourceQueryTypeLogs DataSourceQueryType = "logs"
)

// DataSourceEnricher configures an enricher which calls an external service.
type DataSourceEnricher struct {
	Type DataSourceQueryType `json:"type" yaml:"type" jsonschema:"description=Data source query type ('raw', 'logs')"`

	Raw  *RawDataSourceQuery  `json:"raw,omitempty" yaml:"raw,omitempty" jsonschema:"description=Raw query definition"`
	Logs *LogsDataSourceQuery `json:"logs,omitempty" yaml:"logs,omitempty" jsonschema:"description=Logs query definition"`
}

// RawDataSourceQuery allows defining the entire query request
type RawDataSourceQuery struct {
	// The data source request to perform.
	Request common.Unstructured `json:"request,omitempty" yaml:"request,omitempty" jsonschema:"description=Grafana data source request payload"`

	// The RefID of the response to use. Not required if only a single query is given.
	RefID string `json:"refId,omitempty" yaml:"refId,omitempty" jsonschema:"description=RefID of the response to use, needed if multiple queries are given"`
}

// LogsDataSourceQuery is a simplified method of describing a logs query,
// typically those that return data frames with a "Line" field.
type LogsDataSourceQuery struct {
	// The datasource plugin type
	DataSourceType string `json:"dataSourceType" yaml:"dataSourceType" jsonschema:"description=Data source plugin type (e.g. 'prometheus', 'loki')"`

	// Datasource UID
	DataSourceUID string `json:"dataSourceUid,omitempty" yaml:"dataSourceUid,omitempty" jsonschema:"description=UID of the data source to query"`

	// The logs query to run.
	Expr string `json:"expr" yaml:"expr" jsonschema:"description=Log query expression"`

	// Number of log lines to add to the alert. Defaults to 3.
	MaxLines int `json:"maxLines,omitempty" yaml:"maxLines,omitempty" jsonschema:"description=Maximum number of log lines to include, defaults to 3"`
}

// SiftEnricher configures an enricher which calls into Sift.
type SiftEnricher struct {
	// In the future, there may be configuration options.
}

// AssertsEnricher configures an enricher which calls into Asserts.
type AssertsEnricher struct {
	// In the future, there may be configuration options.
}

// ExplainEnricher uses LLM to generate explanations for alerts.
type ExplainEnricher struct {
	Annotation string `json:"annotation" yaml:"annotation" jsonschema:"description=Annotation name to set the explanation in, by default 'ai_explanation'"`
}

// LoopEnricher configures an enricher which calls into Loop.
type LoopEnricher struct {
	// In the future, there may be configuration options.
}
