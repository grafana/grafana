package serverlock

type serverLock struct {
	// nolint:stylecheck
	Id            int64
	OperationUID  string `xorm:"operation_uid"`
	LastExecution int64
	Version       int64
}
