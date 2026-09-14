package jsonnet

// dev-dashboards.go is excluded from normal builds via `//go:build ignore`, so
// `go mod tidy` never sees its import of codejen and drops the requirement.
// Importing it here (a file with no build constraints) keeps it pinned.
import _ "github.com/grafana/codejen"

//go:generate go run dev-dashboards.go
