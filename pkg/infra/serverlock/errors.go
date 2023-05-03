package serverlock

type ServerLockExistsError struct {
	actionName string
}

func (e *ServerLockExistsError) Error() string {
	return "there is already a lock for this actionName: " + e.actionName
}
