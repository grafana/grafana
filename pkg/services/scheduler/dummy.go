package scheduler

type dummyScheduler struct {
}

func (s *dummyScheduler) Schedule(request ScheduleRequest) (ScheduleId, error) {
	return ScheduleId(""), nil
}
