package log

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/inconshreveable/log15"
)

type FakeLogger struct {
	m map[string]string
}

func (f *FakeLogger) New(ctx ...interface{}) log15.Logger {
	return nil
}

func (f *FakeLogger) Debug(msg string, ctx ...interface{}) {
	f.m["debug"] = msg
}

func (f *FakeLogger) Info(msg string, ctx ...interface{}) {
	f.m["info"] = msg
}

func (f *FakeLogger) Warn(msg string, ctx ...interface{}) {
	f.m["warn"] = msg
}

func (f *FakeLogger) Error(msg string, ctx ...interface{}) {
	f.m["err"] = msg
}

func (f *FakeLogger) Crit(msg string, ctx ...interface{}) {
	f.m["crit"] = msg
}

func (f *FakeLogger) GetHandler() log15.Handler {
	return nil
}

func (f *FakeLogger) SetHandler(l log15.Handler) {}

func TestLogWriter_level(t *testing.T) {
	tests := []struct {
		description      string
		logger           string
		prefix           string
		level            Lvl
		input            []byte
		expectedConsumed int
		expectedOutput   string
	}{
		{
			description:      "level crit",
			logger:           "crit",
			input:            []byte("crit"),
			level:            LvlCrit,
			expectedConsumed: 4,
			expectedOutput:   "crit",
		},
		{
			description:      "level error",
			logger:           "err",
			input:            []byte("error"),
			level:            LvlError,
			expectedConsumed: 5,
			expectedOutput:   "error",
		},
		{
			description:      "level warn",
			logger:           "warn",
			input:            []byte("warn"),
			level:            LvlWarn,
			expectedConsumed: 4,
			expectedOutput:   "warn",
		},
		{
			description:      "level info",
			logger:           "info",
			input:            []byte("info"),
			level:            LvlInfo,
			expectedConsumed: 4,
			expectedOutput:   "info",
		},
		{
			description:      "level debug",
			logger:           "debug",
			input:            []byte("debug"),
			level:            LvlDebug,
			expectedConsumed: 5,
			expectedOutput:   "debug",
		},
		{
			description:      "prefix",
			logger:           "debug",
			input:            []byte("debug"),
			prefix:           "prefix",
			level:            LvlDebug,
			expectedConsumed: 5,
			expectedOutput:   "prefixdebug",
		},
	}

	for _, tc := range tests {
		tc := tc // to avoid timing issues

		t.Run(tc.description, func(t *testing.T) {
			t.Parallel()
			fake := &FakeLogger{m: map[string]string{}}

			w := NewLogWriter(fake, tc.level, tc.prefix)
			n, err := w.Write(tc.input)
			require.NoError(t, err)

			assert.Equal(t, tc.expectedConsumed, n)
			assert.Equal(t, tc.expectedOutput, fake.m[tc.logger])
		})
	}
}
