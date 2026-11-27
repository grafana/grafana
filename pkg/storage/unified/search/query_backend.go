package search

import "github.com/grafana/grafana/pkg/storage/unified/search/enginequery"

// Keep the existing names in the runner and Bleve while sharing the types with gRPC.
type queryBackend = enginequery.Backend
type queryRequest = enginequery.Request
type queryLookupRequest = enginequery.LookupRequest
type queryCursor = enginequery.Cursor
type queryStableSortKey = enginequery.StableSortKey
type queryHit = enginequery.Hit
type queryResult = enginequery.Result
type queryMetadata = enginequery.Metadata
type authzMetadata = enginequery.AuthzMetadata
