package resource

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// normalizeBulkBlobUploads requires an authorized resource and fleet-wide blob
// GC suspension through final publication, including caller-owned transactions.
// The endpoint must bound the upload context and return on receive cancellation.
// Uploads can leave orphans on failure; the original request is never rewritten.
func normalizeBulkBlobUploads(ctx context.Context, req *resourcepb.BulkRequest, backend StreamingBlobSupport, recv func() (*resourcepb.BulkRequest, error)) (*resourcepb.BulkRequest, error) {
	if err := resourcepb.ValidateBulkBlobFrame(req); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid bulk blob frame: %s", err)
	}
	if req.BlobChunk != nil {
		return nil, status.Error(codes.InvalidArgument, "expected a bulk resource, not a blob chunk")
	}
	if failure := verifyRequestKey(req.Key); failure != nil {
		return nil, status.Error(codes.InvalidArgument, failure.Message)
	}
	body, blobs, err := decodeReferenceOnlyBlobBody(req.Value)
	if err != nil {
		return nil, err
	}
	if len(req.BlobUploads) == 0 {
		return req, nil
	}
	if backend == nil {
		return nil, status.Error(codes.Unimplemented, "blob backend does not support streaming")
	}
	if err := validateBulkBlobIdentity(body, req.Key); err != nil {
		return nil, err
	}
	if len(blobs)+len(req.BlobUploads) > resourcepb.MaxInlineBlobEntries {
		return nil, status.Errorf(codes.InvalidArgument, "inline blobs allow at most %d entries", resourcepb.MaxInlineBlobEntries)
	}
	for name := range blobs {
		if strings.TrimSpace(name) == "" {
			return nil, status.Error(codes.InvalidArgument, "inline blob names must not be empty")
		}
	}
	for _, upload := range req.BlobUploads {
		if _, exists := blobs[upload.Name]; exists {
			return nil, status.Errorf(codes.InvalidArgument, "blob upload %q collides with an existing entry", upload.Name)
		}
	}
	if blobs == nil {
		blobs = make(map[string]json.RawMessage, len(req.BlobUploads))
	}

	for _, upload := range req.BlobUploads {
		reader := &bulkBlobReader{ctx: ctx, recv: recv, upload: upload}
		rsp, err := backend.PutResourceBlobStream(ctx, &resourcepb.PutBlobRequest{
			Resource:    proto.Clone(req.Key).(*resourcepb.ResourceKey),
			ContentType: upload.ContentType,
			Method:      resourcepb.PutBlobRequest_GRPC,
		}, reader)
		if err != nil {
			return nil, err
		}
		if rsp == nil {
			return nil, status.Error(codes.Internal, "blob backend returned no upload response")
		}
		if err := ErrorFromResponse(rsp.Error, nil); err != nil {
			return nil, err
		}
		if err := ctx.Err(); err != nil {
			return nil, status.FromContextError(err).Err()
		}
		if reader.err != nil {
			return nil, reader.err
		}
		// Do not drain here: discarded bytes must not turn a truncated upload
		// into an apparently successful reference publication.
		if !reader.complete {
			return nil, status.Error(codes.Internal, "blob backend returned before consuming upload EOF")
		}
		mediaType, params, typeErr := mime.ParseMediaType(upload.ContentType)
		if typeErr != nil {
			return nil, status.Error(codes.InvalidArgument, "invalid blob upload content type")
		}
		responseType, _, responseErr := mime.ParseMediaType(rsp.MimeType)
		if strings.TrimSpace(rsp.Uid) == "" || rsp.Size != upload.Size || responseErr != nil || responseType != mediaType {
			return nil, status.Error(codes.Internal, "blob backend returned invalid upload metadata")
		}
		if rsp.Charset != "" {
			params["charset"] = rsp.Charset
		}
		contentType := mime.FormatMediaType(mediaType, params)
		blobs[upload.Name], err = json.Marshal(resourcepb.BlobReference{
			UID: rsp.Uid, ContentType: contentType, Size: rsp.Size, Hash: rsp.Hash,
		})
		if err != nil {
			return nil, err
		}
	}

	body["blobs"], err = json.Marshal(blobs)
	if err != nil {
		return nil, err
	}
	value, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	result := proto.Clone(req).(*resourcepb.BulkRequest)
	result.Value = value
	result.BlobUploads = nil
	return result, nil
}

func validateBulkBlobIdentity(body map[string]json.RawMessage, key *resourcepb.ResourceKey) error {
	metadata, err := resourcepb.DecodeBlobObject(body["metadata"])
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid bulk resource metadata: %s", err)
	}
	var name, namespace, apiVersion string
	if err := json.Unmarshal(metadata["name"], &name); err != nil || name != key.Name {
		return status.Error(codes.InvalidArgument, "bulk resource name must match request key")
	}
	if raw, present := metadata["namespace"]; present {
		if err := json.Unmarshal(raw, &namespace); err != nil {
			return status.Error(codes.InvalidArgument, "invalid bulk resource namespace")
		}
	}
	if namespace != key.Namespace {
		return status.Error(codes.InvalidArgument, "bulk resource namespace must match request key")
	}
	if err := json.Unmarshal(body["apiVersion"], &apiVersion); err != nil {
		return status.Error(codes.InvalidArgument, "invalid bulk resource apiVersion")
	}
	gv, err := schema.ParseGroupVersion(apiVersion)
	if err != nil || gv.Group != key.Group {
		return status.Error(codes.InvalidArgument, "bulk resource group must match request key")
	}
	return nil
}

// bulkBlobReader consumes exactly one declared upload, including its explicit
// EOF frame. It never reads ahead into the next upload or resource. The caller
// must validate the declaration and authorize its resource before reading.
// Upload success alone is insufficient: callers must also require completion
// before publishing a reference, since a backend may stop reading early.
type bulkBlobReader struct {
	ctx      context.Context
	recv     func() (*resourcepb.BulkRequest, error)
	upload   *resourcepb.BulkBlobUpload
	pending  []byte
	total    int64
	complete bool
	err      error
}

func (r *bulkBlobReader) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if r.err != nil {
		return 0, r.err
	}
	if err := r.ctx.Err(); err != nil {
		r.err = status.FromContextError(err).Err()
		return 0, r.err
	}
	if r.complete {
		return 0, io.EOF
	}
	if len(r.pending) == 0 {
		if err := r.nextChunk(); err != nil {
			r.err = err
			return 0, err
		}
		if r.complete {
			return 0, io.EOF
		}
	}
	n := copy(p, r.pending)
	r.pending = r.pending[n:]
	return n, nil
}

func (r *bulkBlobReader) nextChunk() error {
	req, err := recvBulkBlobFrame(r.ctx, r.recv)
	if errors.Is(err, io.EOF) {
		return status.Error(codes.InvalidArgument, "bulk stream ended before final blob chunk")
	}
	if err != nil {
		return err
	}
	if err := resourcepb.ValidateBulkBlobFrame(req); err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid blob frame: %s", err)
	}
	chunk := req.BlobChunk
	if chunk == nil {
		return status.Error(codes.InvalidArgument, "expected blob chunk before next resource")
	}
	if chunk.Name != r.upload.Name {
		return status.Error(codes.InvalidArgument, "blob chunks must follow declaration order")
	}
	if chunk.Last {
		if r.total != r.upload.Size {
			return status.Error(codes.InvalidArgument, "blob size does not match declaration")
		}
		r.complete = true
		return nil
	}
	if int64(len(chunk.Value)) > r.upload.Size-r.total {
		return status.Error(codes.InvalidArgument, "blob exceeds declared size")
	}
	r.total += int64(len(chunk.Value))
	r.pending = chunk.Value
	return nil
}

func recvBulkBlobFrame(ctx context.Context, recv func() (*resourcepb.BulkRequest, error)) (*resourcepb.BulkRequest, error) {
	if err := ctx.Err(); err != nil {
		return nil, status.FromContextError(err).Err()
	}
	type result struct {
		msg *resourcepb.BulkRequest
		err error
	}
	ch := make(chan result, 1)
	// Recv has no per-call context. On timeout the endpoint must return, which
	// closes the underlying stream and unblocks this single pending receive.
	go func() {
		msg, err := recv()
		ch <- result{msg: msg, err: err}
	}()
	select {
	case received := <-ch:
		if err := ctx.Err(); err != nil {
			return nil, status.FromContextError(err).Err()
		}
		return received.msg, received.err
	case <-ctx.Done():
		return nil, status.FromContextError(ctx.Err()).Err()
	}
}
