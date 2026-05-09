//go:build arm

package sql

// IsKnownEngineFunction always returns false on arm, where go-mysql-server is
// not available. All disallowed function names are bucketed as "unknown".
func IsKnownEngineFunction(_ string) bool {
	return false
}
