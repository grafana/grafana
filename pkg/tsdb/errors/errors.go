package errors

import "reflect"

// BadRequest means a bad request was issued.
type BadRequest struct {
	Reason string
}

// Error returns the error message.
func (br BadRequest) Error() string {
	return br.Reason
}

// Is returns whether another error is the same as this.
func (br BadRequest) Is(err error) bool {
	return reflect.TypeOf(err).AssignableTo(reflect.TypeOf(br))
}
