package serverlock

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	. "github.com/smartystreets/goconvey/convey"
)

func createTestableServerLock(t *testing.T) *ServerLockService {
	t.Helper()

	sqlstore := sqlstore.InitTestDB(t)

	return &ServerLockService{
		SQLStore: sqlstore,
		log:      log.New("test-logger"),
	}
}

func TestServerLock(t *testing.T) {
	Convey("Server lock", t, func() {
		sl := createTestableServerLock(t)
		operationUID := "test-operation"

		first, err := sl.getOrCreate(context.Background(), operationUID)
		So(err, ShouldBeNil)

		lastExecution := first.LastExecution
		Convey("trying to create three new row locks", func() {
			for i := 0; i < 3; i++ {
				first, err = sl.getOrCreate(context.Background(), operationUID)
				So(err, ShouldBeNil)
				So(first.OperationUid, ShouldEqual, operationUID)
				So(first.Id, ShouldEqual, 1)
			}

			Convey("Should not create new since lock already exist", func() {
				So(lastExecution, ShouldEqual, first.LastExecution)
			})
		})

		Convey("Should be able to create lock on first row", func() {
			gotLock, err := sl.acquireLock(context.Background(), first)
			So(err, ShouldBeNil)
			So(gotLock, ShouldBeTrue)

			gotLock, err = sl.acquireLock(context.Background(), first)
			So(err, ShouldBeNil)
			So(gotLock, ShouldBeFalse)
		})
	})
}
