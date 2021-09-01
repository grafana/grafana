package logging

import (
	"strings"

	glog "github.com/grafana/grafana/pkg/infra/log"
)

// GoKitWrapper wraps around the grafana-specific logger to make a compatible logger for go-kit.
type GoKitWrapper struct {
	logger glog.Logger
}

// NewWrapper creates a new go-kit wrapper for a grafana-specific logger
func NewWrapper(l glog.Logger) *GoKitWrapper {
	return &GoKitWrapper{logger: l}
}

// Write implements io.Writer
func (w *GoKitWrapper) Write(p []byte) (n int, err error) {
	withoutNewline := strings.TrimSuffix(string(p), "\n")
	w.logger.Info(withoutNewline)
	return len(p), nil
}
