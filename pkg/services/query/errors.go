package query

import "fmt"

// ErrBadQuery returned whenever request is malformed and must contain a message
// suitable to return in API response.
type ErrBadQuery struct {
	Message string
}

func NewErrBadQuery(msg string) *ErrBadQuery {
	return &ErrBadQuery{Message: msg}
}

func (e ErrBadQuery) Error() string {
	return fmt.Sprintf("bad query: %s", e.Message)
}
