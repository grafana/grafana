package dualwrite

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/setting"
)

// This format was used in early G12 provisioning config.  It should be removed after 12.1
// This migration will be called once, and will remove the file based option even if the input was invalid
func migrateFileDBTo(cfg *setting.Cfg, db *keyvalueDB) {
	fpath := filepath.Join(cfg.DataPath, "dualwrite.json")
	v, err := os.ReadFile(fpath) // nolint:gosec
	if err != nil {
		return // the file does not exist, so nothign required
	}
	logger := logging.DefaultLogger.With("logger", "dualwrite-migrator")

	old := make(map[string]StorageStatus)
	err = json.Unmarshal(v, &old)
	if err != nil {
		logger.Warn("error loading dual write settings", "err", err)
	}

	for _, v := range old {
		err = db.set(context.Background(), v)
		if err != nil {
			logger.Warn("error migrating dual write value", "err", err)
		}
	}

	err = os.Remove(fpath)
	if err != nil {
		logger.Warn("error removing old dual write settings", "err", err)
	}
}
