package resource

import (
	"bytes"
	context "context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"mime"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"gocloud.dev/blob"

	"github.com/grafana/grafana/pkg/apimachinery/utils"

	// Supported drivers
	_ "gocloud.dev/blob/azureblob"
	_ "gocloud.dev/blob/fileblob"
	_ "gocloud.dev/blob/gcsblob"
	_ "gocloud.dev/blob/memblob"
	_ "gocloud.dev/blob/s3blob"
)

type CDKBlobSupportOptions struct {
	Tracer        trace.Tracer
	Bucket        CDKBucket
	RootFolder    string
	URLExpiration time.Duration
}

// Called in a context that loaded the possible drivers
func OpenBlobBucket(ctx context.Context, url string) (*blob.Bucket, error) {
	if strings.HasPrefix(url, "file:") {
		// Don't write metadata attributes
		if strings.Contains(url, "?") {
			url += "&metadata=skip"
		} else {
			url += "?metadata=skip"
		}
	}
	return blob.OpenBucket(ctx, url)
}

func NewCDKBlobSupport(ctx context.Context, opts CDKBlobSupportOptions) (BlobSupport, error) {
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("cdk-blob-store")
	}

	if opts.Bucket == nil {
		return nil, fmt.Errorf("missing bucket")
	}
	if opts.URLExpiration < 1 {
		opts.URLExpiration = time.Minute * 10 // 10 min default
	}

	found, _, err := opts.Bucket.ListPage(ctx, blob.FirstPageToken, 1, &blob.ListOptions{
		Prefix:    opts.RootFolder,
		Delimiter: "/",
	})
	if err != nil {
		return nil, err
	}
	if found == nil {
		return nil, fmt.Errorf("the root folder does not exist")
	}

	return &cdkBlobSupport{
		tracer:      opts.Tracer,
		bucket:      opts.Bucket,
		root:        opts.RootFolder,
		cansignurls: false, // TODO depends on the implementation
		expiration:  opts.URLExpiration,
	}, nil
}

type cdkBlobSupport struct {
	tracer      trace.Tracer
	bucket      CDKBucket
	root        string
	cansignurls bool
	expiration  time.Duration
}

func (s *cdkBlobSupport) getBlobPath(key *ResourceKey, info *utils.BlobInfo) (string, error) {
	var buffer bytes.Buffer
	buffer.WriteString(s.root)

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
	buffer.WriteString(info.UID)

	ext, err := mime.ExtensionsByType(info.MimeType)
	if err != nil {
		return "", err
	}
	if len(ext) > 0 {
		buffer.WriteString(ext[0])
	}
	return buffer.String(), nil
}

func (s *cdkBlobSupport) SupportsSignedURLs() bool {
	return s.cansignurls
}

func (s *cdkBlobSupport) PutResourceBlob(ctx context.Context, req *PutBlobRequest) (*PutBlobResponse, error) {
	info := &utils.BlobInfo{
		UID: uuid.New().String(),
	}
	info.SetContentType(req.ContentType)
	path, err := s.getBlobPath(req.Resource, info)
	if err != nil {
		return nil, err
	}

	rsp := &PutBlobResponse{Uid: info.UID, MimeType: info.MimeType, Charset: info.Charset}
	if req.Method == PutBlobRequest_HTTP {
		rsp.Url, err = s.bucket.SignedURL(ctx, path, &blob.SignedURLOptions{
			Method:      "PUT",
			Expiry:      s.expiration,
			ContentType: req.ContentType,
		})
		return rsp, err
	}
	if len(req.Value) < 1 {
		return nil, fmt.Errorf("missing content value")
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

	// Set the MD5 hash if missing
	if len(attrs.MD5) == 0 {
		h := md5.New()
		_, _ = h.Write(req.Value)
		attrs.MD5 = h.Sum(nil)
	}
	rsp.Hash = hex.EncodeToString(attrs.MD5[:])
	return rsp, err
}

func (s *cdkBlobSupport) GetResourceBlob(ctx context.Context, resource *ResourceKey, info *utils.BlobInfo, mustProxy bool) (*GetBlobResponse, error) {
	path, err := s.getBlobPath(resource, info)
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
