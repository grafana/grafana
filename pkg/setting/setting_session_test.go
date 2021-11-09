package setting

import (
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/stretchr/testify/require"
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

func (stub *testLogger) Info(testMessage string, ctx ...interface{}) {

}

func TestSessionSettings(t *testing.T) {
	skipStaticRootValidation = true

	t.Run("Reading session should log error ", func(t *testing.T) {
		cfg := NewCfg()
		homePath := "../../"

		stub := &testLogger{}
		cfg.Logger = stub

		err := cfg.Load(CommandLineArgs{
			HomePath: homePath,
			Config:   filepath.Join(homePath, "pkg/setting/testdata/session.ini"),
		})
		require.Nil(t, err)

		require.Equal(t, true, stub.warnCalled)
		require.Greater(t, len(stub.warnMessage), 0)
	})
}
