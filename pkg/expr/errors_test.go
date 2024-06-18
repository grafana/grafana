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
