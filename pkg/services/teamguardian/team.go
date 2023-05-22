package teamguardian

import (
	"context"
)

type TeamGuardian interface {
	DeleteByUser(context.Context, int64) error
}

type Store interface {
	DeleteByUser(context.Context, int64) error
}
