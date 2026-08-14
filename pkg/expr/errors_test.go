package expr_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/expr"
)

func TestQueryErrorType(t *testing.T) {
	qet := expr.QueryError
	utilError := errutil.Error{}
	qe := expr.MakeQueryError("A", "", fmt.Errorf("not work"))

	require.True(t, errors.Is(qe, qet))
	require.True(t, errors.As(qe, &utilError))
}

func TestMakeQueryError_QueryLimit(t *testing.T) {
	t.Run("tags deterministic query-limit rejections as ErrQueryLimit", func(t *testing.T) {
		dsErr := fmt.Errorf("execution: the query exceeded the maximum number of chunks (limit: 2000000 chunks) (err-mimir-max-chunks-per-query). Consider reducing the time range")
		qe := expr.MakeQueryError("A", "uid", dsErr)

		require.True(t, errors.Is(qe, expr.ErrQueryLimit), "should be classifiable as a query-limit error")
		// It must remain a normal query error and a usable errutil.Error.
		require.True(t, errors.Is(qe, expr.QueryError))
		utilError := errutil.Error{}
		require.True(t, errors.As(qe, &utilError))
		// The message must be preserved: the underlying Mimir ID is still present and
		// the sentinel's own text is not injected into the rendered error.
		require.Contains(t, qe.Error(), "err-mimir-max-chunks-per-query")
		require.NotContains(t, qe.Error(), expr.ErrQueryLimit.Error())
	})

	t.Run("leaves other query errors retryable", func(t *testing.T) {
		qe := expr.MakeQueryError("A", "uid", fmt.Errorf("connection refused"))
		require.False(t, errors.Is(qe, expr.ErrQueryLimit))
	})
}

func TestWrapQueryLimitError(t *testing.T) {
	t.Run("tags a plain (e.g. deserialized) error that carries a query-limit ID", func(t *testing.T) {
		// Mimics an error reconstructed from a remote query service response: a plain
		// error whose message contains the Mimir ID but no original error chain.
		deserialized := errors.New("failed to execute query [A]: execution: the query exceeded the maximum number of chunks (err-mimir-max-chunks-per-query)")
		wrapped := expr.WrapQueryLimitError(deserialized)

		require.True(t, errors.Is(wrapped, expr.ErrQueryLimit))
		require.Equal(t, deserialized.Error(), wrapped.Error(), "message must be preserved")
		require.ErrorIs(t, wrapped, deserialized, "chain to the original error must be preserved")
	})

	t.Run("leaves non-matching errors untouched", func(t *testing.T) {
		err := errors.New("connection refused")
		require.Equal(t, err, expr.WrapQueryLimitError(err))
		require.False(t, errors.Is(expr.WrapQueryLimitError(err), expr.ErrQueryLimit))
	})

	t.Run("nil stays nil", func(t *testing.T) {
		require.NoError(t, expr.WrapQueryLimitError(nil))
	})
}
