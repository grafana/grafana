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

func injectOrgID(ctx context.Context, tenantID string) (context.Context, error) {
	md, ok := metadata.FromOutgoingContext(ctx)
	if !ok {
		md = metadata.New(map[string]string{})
	}
	newCtx := ctx
	if orgIDs, ok := md[lowerOrgIDHeaderName]; ok {
		if len(orgIDs) == 1 {
			if orgIDs[0] != tenantID {
				return ctx, ErrDifferentOrgIDPresent
			}
		} else {
			return ctx, ErrTooManyOrgIDs
		}
	} else {
		md = md.Copy()
		md[lowerOrgIDHeaderName] = []string{tenantID}
		newCtx = metadata.NewOutgoingContext(ctx, md)
	}

	return newCtx, nil
}
