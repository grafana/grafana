package v1beta1

// Type aliases for backwards compatibility with the old hand-written type names.

// Struct types
type Step = AlertEnrichmentStep
type Matcher = AlertEnrichmentMatcher
type Conditional = AlertEnrichmentConditional
type Condition = AlertEnrichmentCondition
type EnricherConfig = AlertEnrichmentEnricherConfig
type AssignEnricher = AlertEnrichmentAssignEnricher
type Assignment = AlertEnrichmentAssignment
type ExternalEnricher = AlertEnrichmentExternalEnricher
type DataSourceEnricher = AlertEnrichmentDataSourceEnricher
type RawDataSourceQuery = AlertEnrichmentRawDataSourceQuery
type LogsDataSourceQuery = AlertEnrichmentLogsDataSourceQuery
type ExplainEnricher = AlertEnrichmentExplainEnricher

// Empty enricher types (generated as interface{})
type SiftEnricher = AlertEnrichmentSiftEnricher
type AssertsEnricher = AlertEnrichmentAssertsEnricher
type LoopEnricher = AlertEnrichmentLoopEnricher
type AssistantEnricher = AlertEnrichmentAssistantEnricher
type QuerySampleEnricher = AlertEnrichmentQuerySampleEnricher

// Enum types
type StepType = AlertEnrichmentStepType
type MatchType = AlertEnrichmentMatcherType
type EnricherType = AlertEnrichmentEnricherConfigType
type DataSourceQueryType = AlertEnrichmentDataSourceEnricherType

// StepType constants
const (
	StepTypeEnricher    = AlertEnrichmentStepTypeEnricher
	StepTypeConditional = AlertEnrichmentStepTypeConditional
)

// MatchType constants
const (
	MatchTypeEqual    = AlertEnrichmentMatcherTypeEqual
	MatchTypeNotEqual = AlertEnrichmentMatcherTypeNotEqual
	MatchTypeRegexp   = AlertEnrichmentMatcherTypeEqualRegex
	MatchNotRegexp    = AlertEnrichmentMatcherTypeNotEqualRegex
)

// EnricherType constants
const (
	EnricherTypeAssign          = AlertEnrichmentEnricherConfigTypeAssign
	EnricherTypeExternal        = AlertEnrichmentEnricherConfigTypeExternal
	EnricherTypeDataSourceQuery = AlertEnrichmentEnricherConfigTypeDsquery
	EnricherTypeSift            = AlertEnrichmentEnricherConfigTypeSift
	EnricherTypeAsserts         = AlertEnrichmentEnricherConfigTypeAsserts
	EnricherTypeExplain         = AlertEnrichmentEnricherConfigTypeExplain
	EnricherTypeLoop            = AlertEnrichmentEnricherConfigTypeLoop
	EnricherTypeAssistant       = AlertEnrichmentEnricherConfigTypeAssistant
	EnricherTypeQuerySample     = AlertEnrichmentEnricherConfigTypeQuerySample
)

// DataSourceQueryType constants
const (
	DataSourceQueryTypeRaw  = AlertEnrichmentDataSourceEnricherTypeRaw
	DataSourceQueryTypeLogs = AlertEnrichmentDataSourceEnricherTypeLogs
)
