package userauth

import "context"

type Service interface {
	DeleteUserAuth(ctx context.Context, userID int64) error
	DeleteUSerAuthToken(ctx context.Context, userID int64) error
}
