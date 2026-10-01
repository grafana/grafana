package resourceclient

import (
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient/resourceutil"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const SEARCH_FIELD_NAME = resourceutil.SEARCH_FIELD_NAME

func NewResourceVersionExpiredError(rv int64) error {
	return resourceutil.NewResourceVersionExpiredError(rv)
}

func IsResourceVersionExpired(err error) bool { return resourceutil.IsResourceVersionExpired(err) }

func IsConflict(err error) bool { return resourceutil.IsConflict(err) }

func ErrorFromResponse(respErr *resourcepb.ErrorResult, err error) error {
	return resourceutil.ErrorFromResponse(respErr, err)
}

func ErrorResultFromGRPCDetails(err error) *resourcepb.ErrorResult {
	return resourceutil.ErrorResultFromGRPCDetails(err)
}

func AsErrorResult(err error) *resourcepb.ErrorResult { return resourceutil.AsErrorResult(err) }

func GetError(res *resourcepb.ErrorResult) error { return resourceutil.GetError(res) }

func IsSnowflake(rv int64) bool { return resourceutil.IsSnowflake(rv) }

func SnowflakeFromRV(rv int64) int64 { return resourceutil.SnowflakeFromRV(rv) }
