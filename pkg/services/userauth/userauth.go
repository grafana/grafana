package userauth

import "context"

type Service interface {
	Delete(ctx context.Context, userID int64) error
	DeleteToken(ctx context.Context, userID int64) error
}
