package userauth

import "context"

type Service interface {
	Delete(context.Context, int64) error
	DeleteToken(context.Context, int64) error
}
