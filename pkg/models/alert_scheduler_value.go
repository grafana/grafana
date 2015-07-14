package models

type AlertSchedulerValue struct {
	Id    string
	Value string
}

type UpdateAlertSchedulerValueCommand struct {
	Id    string
	Value string
}

type GetAlertSchedulerValueQuery struct {
	Id     string
	Result string
}
