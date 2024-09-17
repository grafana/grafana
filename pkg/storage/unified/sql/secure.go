package sql

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// UpdateSecureFields implements SecureBackend.
func (b *backend) UpdateSecureFields(ctx context.Context, key *resource.ResourceKey, fields map[string]*resource.SecureValue) *resource.ErrorResult {
	if true {
		pretty, err := json.MarshalIndent(fields, "", "  ")
		if err != nil {
			return resource.AsErrorResult(err)
		}
		fmt.Printf("TODO... just pretend for now: %s\n", string(pretty))
		return nil //
	}
	return &resource.ErrorResult{
		Message: "Not yet implemented in SQL",
		Code:    http.StatusNotImplemented,
	}
}

// ReadSecureFields implements SecureBackend.
func (b *backend) ReadSecureFields(ctx context.Context, key *resource.ResourceKey, decrypt bool) (map[string]*resource.SecureValue, *resource.ErrorResult) {
	if true {
		return map[string]*resource.SecureValue{
			"aaaa": {
				Guid:  "FetchTheGUID A",
				Value: "TODO Fetch and decrypt aaaa",
			},
			"bbbb": {
				Guid:  "FetchTheGUID B",
				Value: "TODO Fetch and decrypt bbbb",
			},
		}, nil
	}
	return nil, &resource.ErrorResult{
		Message: "Not yet implemented in SQL",
		Code:    http.StatusNotImplemented,
	}
}
