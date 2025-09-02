package contracts

import "time"

type Clock interface {
	Now() time.Time
}
