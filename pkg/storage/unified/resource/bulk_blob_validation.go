package resource

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"

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
	if len(req.Value) == 0 {
		return nil
	}
	body, err := bulkBlobInputObject(req.Value)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid bulk resource body: %s", err)
	}
	rawBlobs, present := body["blobs"]
	if !present || bytes.Equal(bytes.TrimSpace(rawBlobs), []byte("null")) {
		return nil
	}
	blobs, err := bulkBlobInputObject(rawBlobs)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid blobs: %s", err)
	}
	for name, raw := range blobs {
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			return status.Errorf(codes.InvalidArgument, "invalid blobs.%s: %s", name, err)
		}
		// Presence matters: null and empty data are not reference-only inputs.
		// Do not decode base64, or tighten existing reference metadata validation.
		if _, inline := fields["data"]; inline {
			return status.Error(codes.InvalidArgument, "bulk resource bodies must contain blob references only")
		}
	}
	return nil
}

// Reject duplicate resource/blob names so an inline-bearing entry cannot be
// hidden by a later reference while the original bytes are persisted unchanged.
func bulkBlobInputObject(value []byte) (map[string]json.RawMessage, error) {
	decoder := json.NewDecoder(bytes.NewReader(value))
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	if token != json.Delim('{') {
		return nil, fmt.Errorf("expected JSON object")
	}
	fields := make(map[string]json.RawMessage)
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return nil, err
		}
		name, ok := token.(string)
		if !ok {
			return nil, fmt.Errorf("expected JSON field name")
		}
		if _, exists := fields[name]; exists {
			return nil, fmt.Errorf("duplicate JSON field %q", name)
		}
		var raw json.RawMessage
		if err := decoder.Decode(&raw); err != nil {
			return nil, err
		}
		fields[name] = raw
	}
	if _, err := decoder.Token(); err != nil {
		return nil, err
	}
	if _, err := decoder.Token(); err != io.EOF {
		return nil, fmt.Errorf("unexpected trailing JSON")
	}
	return fields, nil
}
