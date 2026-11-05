package resource

import (
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
	// Unnegotiated framing must fail closed. In particular, chunks have no key.
	if req.BlobChunk != nil || len(req.BlobUploads) > 0 {
		return status.Error(codes.Unimplemented, "framed bulk blob uploads are not supported yet")
	}
	if failure := verifyRequestKey(req.Key); failure != nil {
		return status.Error(codes.InvalidArgument, failure.Message)
	}
	_, _, err := decodeReferenceOnlyBlobBody(req.Value)
	return err
}
