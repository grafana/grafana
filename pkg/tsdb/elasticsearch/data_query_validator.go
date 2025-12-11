package elasticsearch

import (
	"fmt"
)

// isQueryWithError validates the query and returns an error if invalid
func isQueryWithError(query *Query) error {
	if len(query.BucketAggs) == 0 {
		// If no aggregations, only document and logs queries are valid
		if len(query.Metrics) == 0 || (!isLogsQuery(query) && !isDocumentQuery(query)) {
			return fmt.Errorf("invalid query, missing metrics and aggregations")
		}
	}
	return nil
}

// isLogsQuery checks if the query is a logs query
func isLogsQuery(query *Query) bool {
	return len(query.Metrics) > 0 && query.Metrics[0].Type == logsType
}

// isDocumentQuery checks if the query is a document query (raw_data or raw_document)
func isDocumentQuery(query *Query) bool {
	return isRawDataQuery(query) || isRawDocumentQuery(query)
}

// isRawDataQuery checks if the query is a raw_data query
func isRawDataQuery(query *Query) bool {
	return len(query.Metrics) > 0 && query.Metrics[0].Type == rawDataType
}

// isRawDocumentQuery checks if the query is a raw_document query
func isRawDocumentQuery(query *Query) bool {
	return len(query.Metrics) > 0 && query.Metrics[0].Type == rawDocumentType
}
