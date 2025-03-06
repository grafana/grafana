package sql

import (
	context "context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	_ resource.BlobSupport = (*backend)(nil)
)

func (b *backend) SupportsSignedURLs() bool {
	return false
}

func (b *backend) PutResourceBlob(ctx context.Context, req *resource.PutBlobRequest) (*resource.PutBlobResponse, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"PutResourceBlob")
	defer span.End()

	if req.Method == resource.PutBlobRequest_HTTP {
		return &resource.PutBlobResponse{
			Error: resource.NewBadRequestError("signed url upload not supported"),
		}, nil
	}

	hasher := md5.New() // same as s3
	_, err := hasher.Write(req.Value)
	if err != nil {
		return nil, err
	}

	info := &utils.BlobInfo{
		UID:  uuid.New().String(),
		Size: int64(len(req.Value)),
		Hash: hex.EncodeToString(hasher.Sum(nil)),
	}
	info.SetContentType(req.ContentType)

	if info.Size < 1 {
		return &resource.PutBlobResponse{
			Error: resource.NewBadRequestError("empty content"),
		}, nil
	}

	// Insert the value
	err = b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		_, err := dbutil.Exec(ctx, tx, sqlResourceBlobInsert, sqlResourceBlobInsertRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Now:         time.Now(),
			Info:        info,
			Key:         req.Resource,
			ContentType: req.ContentType,
			Value:       req.Value,
		})
		return err
	})

	if err != nil {
		return &resource.PutBlobResponse{
			Error: resource.AsErrorResult(err),
		}, nil
	}
	return &resource.PutBlobResponse{
		Uid:      info.UID,
		Size:     info.Size,
		MimeType: info.MimeType,
		Charset:  info.Charset,
		Hash:     info.Hash,
	}, nil
}

func (b *backend) GetResourceBlob(ctx context.Context, key *resource.ResourceKey, info *utils.BlobInfo, mustProxy bool) (*resource.GetBlobResponse, error) {
	ctx, span := b.tracer.Start(ctx, tracePrefix+"GetResourceBlob")
	defer span.End()

	if info == nil {
		return &resource.GetBlobResponse{
			Error: resource.NewBadRequestError("missing blob info"),
		}, nil
	}

	rsp := &resource.GetBlobResponse{}
	err := b.db.WithTx(ctx, ReadCommitted, func(ctx context.Context, tx db.Tx) error {
		rows, err := dbutil.QueryRows(ctx, tx, sqlResourceBlobQuery, sqlResourceBlobQueryRequest{
			SQLTemplate: sqltemplate.New(b.dialect),
			Key:         key,
			UID:         info.UID, // optional
		})
		if err != nil {
			return err
		}
		if rows.Next() {
			uid := ""
			err = rows.Scan(&uid, &rsp.Value, &rsp.ContentType)
			if info.UID != "" && info.UID != uid {
				return fmt.Errorf("unexpected uid in result")
			}
			return err
		}
		rsp.Error = &resource.ErrorResult{
			Code: http.StatusNotFound,
		}
		return err
	})
	if err != nil {
		rsp.Error = resource.AsErrorResult(err)
	}
	return rsp, nil
}
