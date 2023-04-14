package models

const (
	MaxMetricsExceeded         = "MaxMetricsExceeded"
	MaxQueryTimeRangeExceeded  = "MaxQueryTimeRangeExceeded"
	MaxQueryResultsExceeded    = "MaxQueryResultsExceeded"
	MaxMatchingResultsExceeded = "MaxMatchingResultsExceeded"
)

var ErrorMessages = map[string]string{
	MaxMetricsExceeded:         "Maximum number of allowed metrics exceeded. Your search may have been limited",
	MaxQueryTimeRangeExceeded:  "Max time window exceeded for query",
	MaxQueryResultsExceeded:    "Only the first 500 time series can be returned by a query.",
	MaxMatchingResultsExceeded: "The query matched more than 10.000 metrics, results might not be accurate.",
}
