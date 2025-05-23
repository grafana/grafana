package cliutil

type CLIContext interface {
	Bool(string) bool
	String(string) string
	Set(string, string) error
	StringSlice(string) []string
	Path(string) string
	Int64(string) int64
}
