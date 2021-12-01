package expr

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

type expectedError struct{}

func (e expectedError) Error() string {
	return "expected"
}

func TestQueryError_Error(t *testing.T) {
	e := QueryError{
		RefID: "A",
		Err:   errors.New("this is an error message"),
	}
	assert.EqualError(t, e, "failed to execute query A: this is an error message")
}

func TestQueryError_Unwrap(t *testing.T) {
	t.Run("errors.Is", func(t *testing.T) {
		expectedIsErr := errors.New("expected")
		e := QueryError{
			RefID: "A",
			Err:   expectedIsErr,
		}
		assert.True(t, errors.Is(e, expectedIsErr))
	})

	t.Run("errors.As", func(t *testing.T) {
		e := QueryError{
			RefID: "A",
			Err:   expectedError{},
		}
		var expectedAsError expectedError
		assert.True(t, errors.As(e, &expectedAsError))
	})
}
