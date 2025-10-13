package historian

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

type Backend interface {
	Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error
	Query(ctx context.Context, query ngmodels.HistoryQuery) (*data.Frame, error)
}

// MultipleBackend is a state.Historian that records history to multiple backends at once.
// Only one backend is used for reads. The backend selected for read traffic is called the primary and all others are called secondaries.
type MultipleBackend struct {
	primary     Backend
	secondaries []Backend
}

func NewMultipleBackend(primary Backend, secondaries ...Backend) *MultipleBackend {
	return &MultipleBackend{
		primary:     primary,
		secondaries: secondaries,
	}
}

func (h *MultipleBackend) Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error {
	jobs := make([]<-chan error, 0, len(h.secondaries)+1) // One extra for the primary.
	for _, b := range append([]Backend{h.primary}, h.secondaries...) {
		jobs = append(jobs, b.Record(ctx, rule, states))
	}
	errCh := make(chan error, 1)
	go func() {
		defer close(errCh)
		errs := make([]error, 0)
		// Wait for all jobs to complete. Order doesn't matter here, as we always need to wait on the slowest job regardless.
		for _, ch := range jobs {
			err := <-ch
			if err != nil {
				errs = append(errs, err)
			}
		}
		errCh <- Join(errs...)
	}()
	return errCh
}

func (h *MultipleBackend) Query(ctx context.Context, query ngmodels.HistoryQuery) (*data.Frame, error) {
	return h.primary.Query(ctx, query)
}

// TODO: This is vendored verbatim from the Go standard library.
// TODO: The grafana project doesn't support go 1.20 yet, so we can't use errors.Join() directly.
// TODO: Remove this and replace calls with "errors.Join(...)" when go 1.20 becomes the minimum supported version.
//
// Join returns an error that wraps the given errors.
// Any nil error values are discarded.
// Join returns nil if errs contains no non-nil values.
// The error formats as the concatenation of the strings obtained
// by calling the Error method of each element of errs, with a newline
// between each string.
func Join(errs ...error) error {
	n := 0
	for _, err := range errs {
		if err != nil {
			n++
		}
	}
	if n == 0 {
		return nil
	}
	e := &joinError{
		errs: make([]error, 0, n),
	}
	for _, err := range errs {
		if err != nil {
			e.errs = append(e.errs, err)
		}
	}
	return e
}

type joinError struct {
	errs []error
}

func (e *joinError) Error() string {
	var b []byte
	for i, err := range e.errs {
		if i > 0 {
			b = append(b, '\n')
		}
		b = append(b, err.Error()...)
	}
	return string(b)
}

func (e *joinError) Unwrap() []error {
	return e.errs
}
