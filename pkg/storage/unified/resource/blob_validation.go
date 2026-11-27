package resource

import (
	"bytes"
	"encoding/json"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// decodeReferenceOnlyBlobBody also runs before no-op update detection: inline
// bytes must never be accepted as a resource body, even without a new write.
func decodeReferenceOnlyBlobBody(value []byte) (map[string]json.RawMessage, map[string]json.RawMessage, error) {
	if len(value) == 0 {
		return nil, nil, nil
	}
	body, err := resourcepb.DecodeBlobObject(value)
	if err != nil {
		return nil, nil, status.Errorf(codes.InvalidArgument, "invalid resource body: %s", err)
	}
	rawBlobs, present := body["blobs"]
	if !present || bytes.Equal(bytes.TrimSpace(rawBlobs), []byte("null")) {
		return body, nil, nil
	}
	blobs, err := resourcepb.DecodeBlobObject(rawBlobs)
	if err != nil {
		return nil, nil, status.Errorf(codes.InvalidArgument, "invalid blobs: %s", err)
	}
	for name, raw := range blobs {
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			return nil, nil, status.Errorf(codes.InvalidArgument, "invalid blobs.%s: %s", name, err)
		}
		// Presence matters: null and empty data are not reference-only inputs.
		// Do not decode base64, or tighten existing reference metadata validation.
		if _, inline := fields["data"]; inline {
			return nil, nil, status.Error(codes.InvalidArgument, "resource bodies must contain blob references only")
		}
	}
	return body, blobs, nil
}
