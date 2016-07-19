package alerting

// func TestAlertResultHandler(t *testing.T) {
// 	Convey("Test result Handler", t, func() {
// 		resultHandler := ResultHandlerImpl{}
// 		mockResult := &AlertResult{
// 			State: alertstates.Ok,
// 			AlertJob: &AlertJob{
// 				Rule: &AlertRule{
// 					Id:    1,
// 					OrgId: 1,
// 				},
// 			},
// 		}
// 		mockAlertState := &m.AlertState{}
// 		bus.ClearBusHandlers()
// 		bus.AddHandler("test", func(query *m.GetLastAlertStateQuery) error {
// 			query.Result = mockAlertState
// 			return nil
// 		})
//
// 		Convey("Should update", func() {
//
// 			Convey("when no earlier alert state", func() {
// 				mockAlertState = nil
// 				So(resultHandler.shouldUpdateState(mockResult), ShouldBeTrue)
// 			})
//
// 			Convey("alert state have changed", func() {
// 				mockAlertState = &m.AlertState{
// 					State: alertstates.Critical,
// 				}
// 				mockResult.State = alertstates.Ok
// 				So(resultHandler.shouldUpdateState(mockResult), ShouldBeTrue)
// 			})
//
// 			Convey("last alert state was 15min ago", func() {
// 				now := time.Now()
// 				mockAlertState = &m.AlertState{
// 					State:   alertstates.Critical,
// 					Created: now.Add(time.Minute * -30),
// 				}
// 				mockResult.State = alertstates.Critical
// 				mockResult.StartTime = time.Now()
// 				So(resultHandler.shouldUpdateState(mockResult), ShouldBeTrue)
// 			})
// 		})
// 	})
// }
