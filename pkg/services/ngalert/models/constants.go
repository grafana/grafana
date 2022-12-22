package models

const (
	// FromAlertHeaderName name of header added to datasource query requests
	// to denote request is originating from Grafana Alerting.
	//
	// Data sources might check this in query method as sometimes alerting
	// needs special considerations.
	// Several existing systems also compare against the value of this header.
	// Altering this constitutes a breaking change.
	//
	// Note: The spelling of this headers is intentionally degenerate from the
	// others for compatibility reasons. When sent over a network, the key of
	// this header is canonicalized to "Fromalert".
	// However, some datasources still compare against the string "FromAlert".
	FromAlertHeaderName = "FromAlert"

	// CacheSkipHeaderName name of header added to datasource query requests
	// to denote request should not be cached.
	CacheSkipHeaderName = "X-Cache-Skip"
)
