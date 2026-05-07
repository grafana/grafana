# kv module

This directory is a standalone Go module so other repositories can import it without pulling the full Grafana module.

## Module path

Use the module path in `go.mod`:

`github.com/grafana/grafana/pkg/storage/unified/resource/kv`

## External usage

To depend on a specific commit without a tag, use a pseudo-version:

`go get github.com/grafana/grafana/pkg/storage/unified/resource/kv@<COMMIT>`

Go resolves that to a version like:

`v0.0.0-YYYYMMDDHHMMSS-<12-char-commit>`

## Local development

In Grafana, the root `go.mod` and `go.work` use a local `replace` so the workspace builds use the local module path.
