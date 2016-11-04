package alerting

// import (
// 	"context"
// 	"testing"
//
// 	"github.com/grafana/grafana/pkg/models"
// 	. "github.com/smartystreets/goconvey/convey"
// )
//
// func TestAlertResultHandler(t *testing.T) {
// 	Convey("Test result Handler", t, func() {
//
// 		handler := NewResultHandler()
// 		evalContext := NewEvalContext(context.TODO(), &Rule{})
//
// 		Convey("Should update", func() {
//
// 			Convey("when no earlier alert state", func() {
// 				oldState := models.AlertStateOK
//
// 				evalContext.Rule.State = models.AlertStateAlerting
// 				evalContext.Rule.NoDataState = models.NoDataKeepState
// 				evalContext.NoDataFound = true
//
// 				So(handler.shouldUpdateAlertState(evalContext, oldState), ShouldBeFalse)
// 			})
// 		})
// 	})
// }
