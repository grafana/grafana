package quota

import "errors"

var ErrInvalidQuotaTarget = errors.New("invalid quota target")

type ScopeParameters struct {
	OrgID  int64
	UserID int64
}
