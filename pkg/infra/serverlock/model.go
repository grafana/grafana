package serverlock

type serverLock struct {
	Id            int64
	OperationUid  string
	LastExecution int64
	Version       int64
}
