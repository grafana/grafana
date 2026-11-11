package resourcepb

import (
	"fmt"
	"strings"
)

// ValidateBulkBlobFrame checks a single BulkProcess message, leaving legacy
// resource messages to existing validation. It does not validate stream order,
// resource JSON/identity, authorization, or received byte totals. Those checks
// belong to the endpoint before forwarding a completed resource to its backend.
func ValidateBulkBlobFrame(req *BulkRequest) error {
	if req == nil {
		return fmt.Errorf("bulk request must not be nil")
	}
	if chunk := req.BlobChunk; chunk != nil {
		if req.Key != nil || req.Action != BulkRequest_UNKNOWN || len(req.Value) != 0 || req.Folder != "" || len(req.BlobUploads) != 0 {
			return fmt.Errorf("blob chunk frame must not contain resource fields")
		}
		if strings.TrimSpace(chunk.Name) == "" {
			return fmt.Errorf("blob chunk name must not be empty")
		}
		if chunk.Last {
			if len(chunk.Value) != 0 {
				return fmt.Errorf("final blob chunk must contain no bytes")
			}
		} else if len(chunk.Value) == 0 || len(chunk.Value) > BulkBlobChunkSize {
			return fmt.Errorf("blob chunk must contain 1..%d bytes", BulkBlobChunkSize)
		}
		return nil
	}
	if len(req.BlobUploads) == 0 {
		return nil
	}
	if req.Action != BulkRequest_ADDED && req.Action != BulkRequest_MODIFIED {
		return fmt.Errorf("blob uploads require an ADDED or MODIFIED resource")
	}
	if req.Key == nil || len(req.Value) == 0 {
		return fmt.Errorf("blob uploads require a resource key and body")
	}
	if len(req.BlobUploads) > MaxInlineBlobEntries {
		return fmt.Errorf("blob uploads allow at most %d entries", MaxInlineBlobEntries)
	}
	names := make(map[string]struct{}, len(req.BlobUploads))
	for _, upload := range req.BlobUploads {
		if upload == nil || strings.TrimSpace(upload.Name) == "" {
			return fmt.Errorf("blob upload name must not be empty")
		}
		if _, exists := names[upload.Name]; exists {
			return fmt.Errorf("duplicate blob upload %q", upload.Name)
		}
		names[upload.Name] = struct{}{}
		if err := validateBlobContentType(upload.ContentType); err != nil {
			return fmt.Errorf("blob upload %q: %w", upload.Name, err)
		}
		if upload.Size <= 0 || upload.Size > MaxInlineBlobSize {
			return fmt.Errorf("blob upload %q must contain 1..%d bytes", upload.Name, MaxInlineBlobSize)
		}
	}
	return nil
}
