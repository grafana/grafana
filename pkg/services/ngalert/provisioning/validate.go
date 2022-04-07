package provisioning

type ValidationError struct {
	msg string
}

func (e ValidationError) Error() string {
	return e.msg
}

func NewValidationError(msg string) ValidationError {
	return ValidationError{
		msg: msg,
	}
}
