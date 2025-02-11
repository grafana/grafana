package k8sctx

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/component-base/tracing"
	"k8s.io/klog/v2"
)

// Fork creates a new context for Kubernetes APIs to use.
func Fork(refCtx context.Context) (context.Context, context.CancelFunc, error) {
	newCtx := context.Background()

	if ns, ok := request.NamespaceFrom(refCtx); ok {
		newCtx = request.WithNamespace(newCtx, ns)
	}
	if signal := request.ServerShutdownSignalFrom(refCtx); signal != nil {
		newCtx = request.WithServerShutdownSignal(newCtx, signal)
	}

	requester, _ := identity.GetRequester(refCtx)
	if requester != nil {
		newCtx = identity.WithRequester(newCtx, requester)
	}

	usr, ok := request.UserFrom(refCtx)
	if !ok && requester != nil {
		// add in k8s user if not there yet
		var ok bool
		usr, ok = requester.(user.Info)
		if !ok {
			return nil, nil, fmt.Errorf("could not convert user to Kubernetes user")
		}
	}
	if ok {
		newCtx = request.WithUser(newCtx, usr)
	}

	// App SDK logger
	appLogger := logging.FromContext(refCtx)
	newCtx = logging.Context(newCtx, appLogger)
	// Klog logger
	klogger := klog.FromContext(refCtx)
	if klogger.Enabled() {
		newCtx = klog.NewContext(newCtx, klogger)
	}
	// Grafana infra
	infraLogger := log.FromContext(refCtx)
	if len(infraLogger) > 0 {
		newCtx = log.WithContextualAttributes(newCtx, infraLogger)
	}

	// The tracing package deals with both k8s trace and otel.
	if span := tracing.SpanFromContext(refCtx); span != nil && *span != (tracing.Span{}) {
		newCtx = tracing.ContextWithSpan(newCtx, span)
	}

	deadlineCancel := context.CancelFunc(func() {})
	if deadline, ok := refCtx.Deadline(); ok {
		newCtx, deadlineCancel = context.WithDeadline(newCtx, deadline)
	}

	newCtx, cancel := context.WithCancelCause(newCtx)
	// We intentionally do not defer a cancel(nil) here. It wouldn't make sense to cancel until (*ResponseAdapter).Close() is called.
	go func() { // Even context's own impls do goroutines for this type of pattern.
		select {
		case <-newCtx.Done():
			// We don't have to do anything!
		case <-refCtx.Done():
			cancel(context.Cause(refCtx))
		}
		deadlineCancel()
	}()

	return newCtx, context.CancelFunc(func() {
		cancel(nil)
		deadlineCancel()
	}), nil
}
