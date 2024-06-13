package db

// DatabaseWithRepl wraps two DB interfaces together for replication.
type DatabaseWithRepl struct {
	DB
	ReadReplica DB
}
