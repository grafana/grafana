package repository

import (
	"context"
	"errors"
)

type BranchProtectionChecker interface {
	CheckBranchProtection(context.Context, string) (bool, error)
}

type BranchProtectionClient interface {
	CheckBranchProtection(context.Context, string) (bool, error)
}

func ClientCheckBranchProtection(ctx context.Context, client BranchProtectionClient, branch string) (bool, error) {
	if client == nil {
		return false, nil
	}

	protected, err := client.CheckBranchProtection(ctx, branch)
	if errors.Is(err, ErrPermissionDenied) {
		return false, nil
	}
	return protected, err
}
