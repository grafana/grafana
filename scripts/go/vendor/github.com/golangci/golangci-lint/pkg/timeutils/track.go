package timeutils

import (
	"fmt"
	"time"

	"github.com/golangci/golangci-lint/pkg/logutils"
)

func Track(from time.Time, log logutils.Log, format string, args ...interface{}) {
	log.Infof("%s took %s", fmt.Sprintf(format, args...), time.Since(from))
}
