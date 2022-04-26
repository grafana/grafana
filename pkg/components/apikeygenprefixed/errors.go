package apikeygenprefix

type ErrInvalidApiKey struct {
}

func (e *ErrInvalidApiKey) Error() string {
	return "invalid API key"
}
