package sql

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

func (b *backend) PutResourceBlob(ctx context.Context, req *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.PutResourceBlob")
	defer span.End()

	if req.Method == resourcepb.PutBlobRequest_HTTP {
		return nil, resource.GRPCStatusError(resource.NewBadRequestError("signed url upload not supported"))
	}

	hasher := md5.New() // same as s3
	_, err := hasher.Write(req.Value)
	if err != nil {
		return nil, err
	}

	info := &utils.BlobInfo{
		UID:  resource.NewBlobUID(),
		Size: int64(len(req.Value)),
		Hash: hex.EncodeToString(hasher.Sum(nil)),
	}
	info.SetContentType(req.ContentType)

	if info.Size < 1 {
		return nil, resource.GRPCStatusError(resource.NewBadRequestError("empty content"))
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
		return nil, resource.GRPCStatusError(resource.AsErrorResult(err))
	}
	return &resourcepb.PutBlobResponse{
		Uid:      info.UID,
		Size:     info.Size,
		MimeType: info.MimeType,
		Charset:  info.Charset,
		Hash:     info.Hash,
	}, nil
}

func (b *backend) GetResourceBlob(ctx context.Context, key *resourcepb.ResourceKey, info *utils.BlobInfo, mustProxy bool) (*resourcepb.GetBlobResponse, error) {
	ctx, span := tracer.Start(ctx, "sql.backend.GetResourceBlob")
	defer span.End()

	if info == nil {
		return nil, resource.GRPCStatusError(resource.NewBadRequestError("missing blob info"))
	}

	rsp := &resourcepb.GetBlobResponse{}
	found := false
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
			found = err == nil
			return err
		}
		return err
	})
	if err != nil {
		return nil, resource.GRPCStatusError(resource.AsErrorResult(err))
	}
	if !found {
		return nil, resource.GRPCStatusError(&resourcepb.ErrorResult{
			Code: http.StatusNotFound,
		})
	}
	return rsp, nil
}
