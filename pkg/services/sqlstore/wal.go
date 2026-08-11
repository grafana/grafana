package sqlstore

import (
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/log"
)

// walSetting is the parsed form of the [database] wal option.
type walSetting int

const (
	// walAuto turns WAL on only where the filesystem is known to support it.
	walAuto walSetting = iota
	walOn
	walOff
)

const walAutoValue = "auto"

var walLogger = log.New("sqlstore.wal")

// walFilesystemPath returns the path whose filesystem decides whether WAL is used.
func walFilesystemPath(dbPath string) string {
	// An existing database is inspected directly, and statfs follows symlinks.
	if _, err := os.Stat(dbPath); err == nil {
		return dbPath
	}

	// A database that does not exist yet can still be a link to storage elsewhere,
	// which is where SQLite will create it.
	if target, err := os.Readlink(dbPath); err == nil {
		if !filepath.IsAbs(target) {
			target = filepath.Join(filepath.Dir(dbPath), target)
		}
		return filepath.Dir(target)
	}

	return filepath.Dir(dbPath)
}

// resolveWAL decides whether SQLite runs in WAL mode.
//
// WAL requires all processes using the database to share a small amount of memory, so
// it does not work over a network filesystem. We cannot ask a path whether it can
// provide that, so auto only turns WAL on where it is known to hold.
func resolveWAL(setting walSetting, fsName string, fsSupportsWAL bool) bool {
	switch setting {
	case walOff:
		return false
	case walOn:
		if !fsSupportsWAL {
			walLogger.Warn("SQLite WAL mode is enabled on a filesystem where it may fail or corrupt the database",
				"filesystem", fsName)
		}
		return true
	default:
		if !fsSupportsWAL {
			walLogger.Warn("Not enabling SQLite WAL mode because the filesystem holding the database may not support it",
				"filesystem", fsName)
			return false
		}
		walLogger.Debug("Enabling SQLite WAL mode", "filesystem", fsName)
		return true
	}
}
