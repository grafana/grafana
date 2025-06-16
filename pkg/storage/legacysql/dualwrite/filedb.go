package dualwrite

import (
	"encoding/json"
	"os"
)

// This format was used in early G12 provisioning config.  It should be removed
func readFileDB(fpath string) (map[string]StorageStatus, error) {
	v, err := os.ReadFile(fpath)
	if err != nil {
		return nil, err
	}

	db := make(map[string]StorageStatus)
	err = json.Unmarshal(v, &db)
	if err != nil {
		return nil, err
	}

	for k, v := range db {
		// Must write to unified if we are reading unified
		if v.ReadUnified && !v.WriteUnified {
			v.WriteUnified = true
			db[k] = v
		}

		// Make sure we are writing something!
		if !v.WriteLegacy && !v.WriteUnified {
			v.WriteLegacy = true
			db[k] = v
		}
	}
	return db, nil
}
