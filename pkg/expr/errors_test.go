package expr_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/stretchr/testify/require"
)

func TestQueryErrorType(t *testing.T) {
	qet := expr.QueryError
	utilError := errutil.Error{}
	qe := expr.MakeQueryError("A", "", fmt.Errorf("not work"))

	require.True(t, errors.Is(qe, qet))
	require.True(t, errors.As(qe, &utilError))
}
