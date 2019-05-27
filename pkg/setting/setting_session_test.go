package setting

import (
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	. "github.com/smartystreets/goconvey/convey"
)

type testLogger struct {
	log.Logger
	warnCalled  bool
	warnMessage string
}

func (stub *testLogger) Warn(testMessage string, ctx ...interface{}) {
	stub.warnCalled = true
	stub.warnMessage = testMessage
}
func TestSessionSettings(t *testing.T) {
	Convey("session config", t, func() {
		skipStaticRootValidation = true

		Convey("Reading session should log error ", func() {
			var (
				cfg      = NewCfg()
				homePath = "../../"
			)

			stub := &testLogger{}
			cfg.Logger = stub

			cfg.Load(&CommandLineArgs{
				HomePath: homePath,
				Config:   filepath.Join(homePath, "pkg/setting/testdata/session.ini"),
			})

			So(stub.warnCalled, ShouldEqual, true)
			So(len(stub.warnMessage), ShouldBeGreaterThan, 0)
		})
	})
}
