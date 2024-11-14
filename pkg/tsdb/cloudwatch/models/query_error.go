package models

import "fmt"

type QueryError struct {
	Err   error
	RefID string
}

func (e *QueryError) Error() string {
	return fmt.Sprintf("error parsing query %q, %s", e.RefID, e.Err)
}
