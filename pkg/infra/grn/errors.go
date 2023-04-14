package grn

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrInvalidGRN = errutil.NewBase(errutil.StatusValidationFailed, "grn.InvalidGRN")
)
