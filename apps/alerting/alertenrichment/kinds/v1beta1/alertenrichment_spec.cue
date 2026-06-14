package v1beta1

// AlertEnrichmentSpec specifies an alert enrichment pipeline.
AlertEnrichmentSpec: {
	// Title of the alert enrichment.
	title: string

	// Description of the alert enrichment.
	description?: string

	// Alert rules for which to run the enrichment for.
	// If not set, the enrichment runs for all alert rules.
	alertRuleUids?: [...string]

	// LabelMatchers optionally restricts when this enrichment runs.
	labelMatchers?: [...#Matcher]

	// AnnotationMatchers optionally restricts when this enrichment runs.
	annotationMatchers?: [...#Matcher]

	// Receivers optionally restricts the enrichment to one or more receiver names.
	// If not set, the enrichment runs for alerts coming from all receivers.
	receivers?: [...string]

	// Steps of the enrichment pipeline.
	steps: [...#Step]
}

// Step represent an invocation of a single enricher.
#Step: {
	// Step kind: 'enricher' or 'conditional'
	type: "enricher" | "conditional"

	// Timeout is the maximum about of time this specific enrichment is allowed to take.
	// Accepts a Go duration string (e.g. "5s", "1m30s", "500ms").
	timeout: string

	// Enricher specifies what enricher to run and it's configuration.
	enricher?: #EnricherConfig

	// Conditional allows branching to specifies what enricher to run and it's configuration.
	conditional?: #Conditional
}

#Conditional: {
	// If is the condition to evaluate.
	if: #Condition

	// Then is the enrichment steps to perform if all the conditions above are true.
	then: [...#Step]

	// Else is the enrichment steps to perform otherwise.
	else?: [...#Step]
}

#Condition: {
	// LabelMatchers optionally specifies the condition to require matching label values.
	labelMatchers?: [...#Matcher]

	// AnnotationMatchers optionally restricts when the per-alert enrichments are run.
	annotationMatchers?: [...#Matcher]

	// DataSourceQuery is a data source query to run. If the query returns a non-zero value,
	// then the condition is taken to be true.
	dataSourceQuery?: #RawDataSourceQuery
}

// Matcher is used to match label (or annotation) values.
#Matcher: {
	// Comparison operator
	type:  "=" | "!=" | "=~" | "!~" @cuetsy(kind="enum",memberNames="Equal|NotEqual|EqualRegex|NotEqualRegex")
	name:  string
	value: string
}

// EnricherConfig is a discriminated union of enricher configurations.
#EnricherConfig: {
	// Enricher type
	type: "assign" | "external" | "dsquery" | "sift" | "asserts" | "explain" | "loop" | "assistant" | "querySample"

	assign?:      #AssignEnricher
	external?:    #ExternalEnricher
	dataSource?:  #DataSourceEnricher
	sift?:        #SiftEnricher
	asserts?:     #AssertsEnricher
	explain?:     #ExplainEnricher
	loop?:        #LoopEnricher
	assistant?:   #AssistantEnricher
	querySample?: #QuerySampleEnricher
}

// AssignEnricher configures an enricher which assigns annotations.
#AssignEnricher: {
	// Annotations to change and values to set them to.
	annotations: [...#Assignment]
}

#Assignment: {
	// Name of the annotation to assign.
	name: string
	// Value to assign to the annotation. Can use Go template format, with access to
	// annotations and labels via e.g. {{$annotations.x}}
	value: string
}

// ExternalEnricher configures an enricher which calls an external service.
#ExternalEnricher: {
	// URL of the external HTTP service to call out to.
	url: string
}

// DataSourceEnricher configures an enricher which calls an external service.
#DataSourceEnricher: {
	// Data source query type
	type: "raw" | "logs"

	raw?:  #RawDataSourceQuery
	logs?: #LogsDataSourceQuery
}

// RawDataSourceQuery allows defining the entire query request
#RawDataSourceQuery: {
	// The data source request to perform.
	request?: {
		[string]: _
	}

	// The RefID of the response to use. Not required if only a single query is given.
	refId?: string
}

// LogsDataSourceQuery is a simplified method of describing a logs query,
// typically those that return data frames with a "Line" field.
#LogsDataSourceQuery: {
	// The datasource plugin type
	dataSourceType: string

	// Datasource UID
	dataSourceUid?: string

	// The logs query to run.
	expr: string

	// Number of log lines to add to the alert. Defaults to 3.
	maxLines?: int
}

// SiftEnricher configures an enricher which calls into Sift.
#SiftEnricher: {}

// AssertsEnricher configures an enricher which calls into Asserts.
#AssertsEnricher: {}

// ExplainEnricher uses LLM to generate explanations for alerts.
#ExplainEnricher: {
	annotation: string
}

// LoopEnricher configures an enricher which calls into Loop.
#LoopEnricher: {}

// AssistantEnricher configures an enricher which calls into Assistant.
#AssistantEnricher: {}

// QuerySampleEnricher configures an enricher that samples data from the queries
// used in the alert rule definition, such as logs.
#QuerySampleEnricher: {}
