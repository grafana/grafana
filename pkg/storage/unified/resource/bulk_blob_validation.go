package resource

import (
	"bytes"
	"encoding/json"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// validateBulkBlobInput runs independently of backend validation: SkipValidation
// must not allow inline bytes or unconsumed upload declarations into history.
func validateBulkBlobInput(req *resourcepb.BulkRequest) error {
	if err := resourcepb.ValidateBulkBlobFrame(req); err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid bulk blob frame: %s", err)
	}
	// Do not accept framing until uploads, reference publication, and lifecycle
	// protection are implemented together. In particular, chunks have no key.
	if req.BlobChunk != nil || len(req.BlobUploads) > 0 {
		return status.Error(codes.Unimplemented, "framed bulk blob uploads are not supported yet")
	}
	if failure := verifyRequestKey(req.Key); failure != nil {
		return status.Error(codes.InvalidArgument, failure.Message)
	}
	_, _, err := decodeBulkBlobBody(req.Value)
	return err
}

func decodeBulkBlobBody(value []byte) (map[string]json.RawMessage, map[string]json.RawMessage, error) {
	if len(value) == 0 {
		return nil, nil, nil
	}
	body, err := resourcepb.DecodeBlobObject(value)
	if err != nil {
		return nil, nil, status.Errorf(codes.InvalidArgument, "invalid bulk resource body: %s", err)
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
			return nil, nil, status.Error(codes.InvalidArgument, "bulk resource bodies must contain blob references only")
		}
	}
	return body, blobs, nil
}
