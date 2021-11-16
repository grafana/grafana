package expr

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestQueryError(t *testing.T) {
	e := QueryError{
		RefID: "A",
		Err:   errors.New("this is an error message"),
	}
	assert.EqualError(t, e, "failed to execute query A: this is an error message")
}
