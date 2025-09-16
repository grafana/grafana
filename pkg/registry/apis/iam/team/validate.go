package team

import (
	"context"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func ValidateOnCreate(ctx context.Context, obj *iamv0alpha1.Team) error {
	return nil
}
