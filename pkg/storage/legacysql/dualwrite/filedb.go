package dualwrite

import (
	"context"
	"encoding/json"
	"os"

	"github.com/grafana/grafana-app-sdk/logging"
)

// This format was used in early G12 provisioning config.  It should be removed
func migrateFileDBTo(fpath string, db statusStorage) {
	v, err := os.ReadFile(fpath)
	if err != nil {
		return // nothing needed
	}
	logger := logging.DefaultLogger.With("logger", "dualwrite-migrator")

	old := make(map[string]StorageStatus)
	err = json.Unmarshal(v, &old)
	if err != nil {
		logger.Warn("error loading dual write settings", "err", err)
		return
	}

	for _, v := range old {
		// Must write to unified if we are reading unified
		if v.ReadUnified && !v.WriteUnified {
			v.WriteUnified = true
		}

		// Make sure we are writing something!
		if !v.WriteLegacy && !v.WriteUnified {
			v.WriteLegacy = true
		}

		err = db.Set(context.Background(), v)
		if err != nil {
			logger.Warn("error migrating dual write value", "err", err)
		}
	}

	err = os.Remove(fpath)
	if err != nil {
		logger.Warn("error removing old dual write settings", "err", err)
	}
}
