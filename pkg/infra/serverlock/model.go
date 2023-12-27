package serverlock

type serverLock struct {
	// nolint:stylecheck
	Id            int64  `json:"-"`
	OperationUID  string `xorm:"operation_uid" json:"operation_uid"`
	LastExecution int64  `json:"last_execution" xorm:"last_execution"`
	Version       int64  `json:"-"`
}
