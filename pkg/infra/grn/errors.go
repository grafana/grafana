package grn

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrInvalidGRN = errutil.ValidationFailed("grn.InvalidGRN")
)
