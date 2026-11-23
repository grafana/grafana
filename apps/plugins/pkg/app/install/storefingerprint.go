package install

import (
	"crypto/sha256"
	"encoding/hex"
	"slices"
	"strings"
)

// storeFingerprint identifies the set of plugins a process synced from, so processes with
// different plugin stores can be told apart in logs without listing every plugin.
func storeFingerprint(desired []PluginInstall) string {
	keys := make([]string, 0, len(desired))
	for i := range desired {
		keys = append(keys, desired[i].ID+"@"+desired[i].Version)
	}
	slices.Sort(keys)
	sum := sha256.Sum256([]byte(strings.Join(keys, ",")))
	return hex.EncodeToString(sum[:])[:12]
}
