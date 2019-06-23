package log

import (
	"bytes"
	"io/ioutil"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"gopkg.in/ini.v1"
)

type logStream struct {
	RawStream bytes.Buffer
}

func NewLogStream() logStream {
	return logStream{}
}

func (ls *logStream) stream() []string {
	s := ls.RawStream.String()
	return strings.Split(s, "\n")
}

func Test_MuteLoggerFromConfig(t *testing.T) {
	cfg, err := ini.Load("../../../conf/defaults.ini")
	if err != nil {
		t.Fatalf("Failed to read the configuration file: %v", err)
	}

	cfg.Section("log").Key("mute").SetValue("mutedLogger")

	// Hijack STDOUT
	rescueStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	ReadLoggingConfig([]string{"console"}, "", cfg)

	ls := NewLogStream()

	logger := New("goodLogger")
	mutedLogger := New("mutedLogger")

	logger.Info("one log line")
	logger.Info("two log lines")

	// Restore STDOUT
	w.Close()
	out, _ := ioutil.ReadAll(r)
	ls.RawStream.Write(out)
	os.Stdout = rescueStdout

	assert.Equal(t, 3, len(ls.stream()))

	mutedLogger.Info("log line that should be dropped")

	assert.Equal(t, 3, len(ls.stream()))
}
