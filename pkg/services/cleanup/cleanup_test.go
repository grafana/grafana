package cleanup

import (
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	"testing"
	"time"
)

func TestCleanUpTmpFiles(t *testing.T) {
	Convey("Cleanup service tests", t, func() {
		cfg := setting.Cfg{}
		cfg.TempDataLifetime, _ = time.ParseDuration("24h")
		service := CleanUpService{
			Cfg: &cfg,
		}
		now := time.Now()
		secondAgo := now.Add(-time.Second)
		twoDaysAgo := now.Add(-time.Second * 3600 * 24 * 2)
		weekAgo := now.Add(-time.Second * 3600 * 24 * 7)

		Convey("Should not cleanup recent files", func() {
			So(service.shouldCleanupTempFile(secondAgo, now), ShouldBeFalse)
		})

		Convey("Should cleanup older files", func() {
			So(service.shouldCleanupTempFile(twoDaysAgo, now), ShouldBeTrue)
		})

		Convey("After increasing temporary files lifetime, older files should be kept", func() {
			cfg.TempDataLifetime, _ = time.ParseDuration("1000h")
			So(service.shouldCleanupTempFile(weekAgo, now), ShouldBeFalse)
		})

		Convey("If lifetime is 0, files should never be cleaned up", func() {
			cfg.TempDataLifetime = 0
			So(service.shouldCleanupTempFile(weekAgo, now), ShouldBeFalse)
		})
	})

}
