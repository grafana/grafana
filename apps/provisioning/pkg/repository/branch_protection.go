package repository

import (
	"context"
	"errors"
)

//go:generate mockery --name BranchProtectionChecker --structname MockBranchProtectionChecker --inpackage --filename mock_branch_protection_checker.go --with-expecter
type BranchProtectionChecker interface {
	CheckBranchProtection(context.Context, string) (bool, error)
}

//go:generate mockery --name BranchProtectionClient --structname MockBranchProtectionClient --inpackage --filename mock_branch_protection_client.go --with-expecter
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
