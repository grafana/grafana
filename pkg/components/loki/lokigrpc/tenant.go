package lokigrpc

import (
	"context"
	"errors"

	"google.golang.org/grpc/metadata"
)

const (
	lowerOrgIDHeaderName = "x-scope-orgid"
)

var (
	ErrDifferentOrgIDPresent = errors.New("different org ID already present")
	ErrTooManyOrgIDs         = errors.New("multiple org IDs present")
)

func injectOrgID(ctx context.Context, tenantID string) context.Context {
	md, ok := metadata.FromOutgoingContext(ctx)
	if ok {
		md = md.Copy()
	} else {
		md = metadata.New(map[string]string{})
	}

	md[lowerOrgIDHeaderName] = []string{tenantID}
	newCtx := metadata.NewOutgoingContext(ctx, md)
	return newCtx
}
