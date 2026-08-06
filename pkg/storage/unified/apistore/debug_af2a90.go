package apistore

// #region agent log
import (
	jsonenc "encoding/json"
	"os"
	"time"
)

func dbgAf2a90(location, hypothesisID, message string, data map[string]any) {
	entry := map[string]any{"sessionId": "af2a90", "hypothesisId": hypothesisID, "location": location, "message": message, "data": data, "timestamp": time.Now().UnixMilli()}
	b, _ := jsonenc.Marshal(entry)
	f, err := os.OpenFile("/Users/kostasalexoglou/Documents/grafana/grafana/.cursor/debug-af2a90.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err == nil {
		_, _ = f.Write(append(b, '\n'))
		_ = f.Close()
	}
}

// #endregion
