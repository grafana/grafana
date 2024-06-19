package resource

import (
	"bytes"
	context "context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"gocloud.dev/blob"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type CDKOptions struct {
	Tracer        trace.Tracer
	Bucket        *blob.Bucket
	RootFolder    string
	URLExpiration time.Duration
}

func NewCDKBlobStore(ctx context.Context, opts CDKOptions) (BlobStore, error) {
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("cdk-blob-store")
	}

	if opts.Bucket == nil {
		return nil, fmt.Errorf("missing bucket")
	}
	if opts.URLExpiration < 1 {
		opts.URLExpiration = time.Minute * 10 // 10 min default
	}

	found, err := opts.Bucket.Exists(ctx, opts.RootFolder)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, fmt.Errorf("the root folder does not exist")
	}

	return &cdkBlobStore{
		tracer:      opts.Tracer,
		bucket:      opts.Bucket,
		root:        opts.RootFolder,
		cansignurls: false, // TODO depends on the implementation
		expiration:  opts.URLExpiration,
	}, nil
}

type cdkBlobStore struct {
	tracer      trace.Tracer
	bucket      *blob.Bucket
	root        string
	cansignurls bool
	expiration  time.Duration
}

func getCDKBlobPath(root string, key *ResourceKey, uid string, mime string) (string, error) {
	var buffer bytes.Buffer
	buffer.WriteString(root)

	if key.Namespace == "" {
		buffer.WriteString("__cluster__/")
	} else {
		buffer.WriteString(key.Namespace)
		buffer.WriteString("/")
	}

	if key.Group == "" {
		return "", fmt.Errorf("missing group")
	}
	buffer.WriteString(key.Group)
	buffer.WriteString("/")

	if key.Resource == "" {
		return "", fmt.Errorf("missing resource")
	}
	buffer.WriteString(key.Resource)
	buffer.WriteString("/")

	if key.Name == "" {
		return "", fmt.Errorf("missing name")
	}
	buffer.WriteString(key.Name)
	buffer.WriteString("/")
	buffer.WriteString(uid)

	switch mime {
	case "application/json":
		buffer.WriteString(".json")
	case "image/png":
		buffer.WriteString(".png")
	default:
		return "", fmt.Errorf("unsupported mimetype")
	}
	return buffer.String(), nil
}

func (s *cdkBlobStore) SupportsSignedURLs() bool {
	return s.cansignurls
}

func (s *cdkBlobStore) PutBlob(ctx context.Context, req *PutBlobRequest) (*PutBlobResponse, error) {
	info := &utils.BlobInfo{}
	info.SetContentType(req.ContentType)
	rsp := &PutBlobResponse{Uid: uuid.New().String()}

	path, err := getCDKBlobPath(s.root, req.Resource, rsp.Uid, info.MimeType)
	if err != nil {
		return nil, err
	}
	if req.Method == PutBlobRequest_HTTP {
		rsp.Url, err = s.bucket.SignedURL(ctx, path, &blob.SignedURLOptions{
			Method:      "PUT",
			Expiry:      s.expiration,
			ContentType: req.ContentType,
		})
		return rsp, err
	}

	// Write the value
	err = s.bucket.WriteAll(ctx, path, req.Value, &blob.WriterOptions{
		ContentType: req.ContentType,
	})
	if err != nil {
		return nil, err
	}

	attrs, err := s.bucket.Attributes(ctx, path)
	if err != nil {
		return nil, err
	}
	rsp.Size = attrs.Size
	rsp.Hash = attrs.ETag
	rsp.MimeType = info.MimeType
	rsp.Charset = info.Charset
	return rsp, err
}

func (s *cdkBlobStore) GetBlob(ctx context.Context, resource *ResourceKey, info *utils.BlobInfo, mustProxy bool) (*GetBlobResponse, error) {
	path, err := getCDKBlobPath(s.root, resource, info.UID, info.MimeType)
	if err != nil {
		return nil, err
	}
	rsp := &GetBlobResponse{ContentType: info.ContentType()}
	if mustProxy || !s.cansignurls {
		rsp.Value, err = s.bucket.ReadAll(ctx, path)
		return rsp, err
	}
	rsp.Url, err = s.bucket.SignedURL(ctx, path, &blob.SignedURLOptions{
		Method:      "GET",
		Expiry:      s.expiration,
		ContentType: rsp.ContentType,
	})
	return rsp, err
}
