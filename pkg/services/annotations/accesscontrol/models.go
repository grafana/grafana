package accesscontrol

type dashboardProjection struct {
	ID  int64  `xorm:"id"`
	UID string `xorm:"uid"`
}
