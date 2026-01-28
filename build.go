//go:build ignore
// +build ignore

package main

import (
	"encoding/json"
	"log"
	"os"
	"runtime"
	"time"

	"github.com/grafana/grafana/pkg/build"
)

// #region agent log
func agentLog(hypothesisId, location, message string, data map[string]any) {
	if os.Getenv("CURSOR_DEBUG") != "1" {
		return
	}
	runId := os.Getenv("CURSOR_DEBUG_RUN_ID")
	if runId == "" {
		runId = "run1"
	}

	payload := map[string]any{
		"sessionId":    "debug-session",
		"runId":        runId,
		"hypothesisId": hypothesisId,
		"location":     location,
		"message":      message,
		"data":         data,
		"timestamp":    time.Now().UnixMilli(),
	}

	f, err := os.OpenFile("/Users/jclary/Repos/grafana/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	_ = json.NewEncoder(f).Encode(payload)
	_ = f.Close()
}

// #endregion

func main() {
	log.SetOutput(os.Stdout)
	log.SetFlags(0)
	cwd, _ := os.Getwd()
	agentLog("H4", "build.go:main", "build.go starting", map[string]any{
		"cwd":     cwd,
		"args":    os.Args,
		"go":      runtime.Version(),
		"portEnv": os.Getenv("GF_SERVER_HTTP_PORT"),
	})

	rc := build.RunCmd()
	agentLog("H3", "build.go:main", "build.RunCmd returned", map[string]any{
		"exitCode": rc,
	})
	os.Exit(rc)
}
