# grafdev

Small CLI for **Grafana OSS + sibling `grafana-enterprise`**: paths, read-only health (`doctor`), git helpers (`branch`, `dualize`, `sync`), `ge` (run commands with enterprise as cwd), and pointers for Wire / `enterprise_imports`.

## Quick start

From the OSS repo root:

```bash
go run ./pkg/cmd/grafdev --help
go run ./pkg/cmd/grafdev doctor
go run ./pkg/cmd/grafdev wire patterns
```

**Run `doctor` before** mutating git (`branch`, `dualize`, `sync --apply`, `ge git …`) so branch mismatch, dirty trees, drift, and dev-link issues show up first.

For **OSS vs Enterprise implementations** in Go, see `grafdev wire patterns`—use `wireexts_oss.go` / `wireexts_enterprise.go` bindings, not `cfg.IsEnterprise` alone, when the split must be enforced by **which binary is built**.

## More detail

See [MANUAL_TESTING.md](./MANUAL_TESTING.md) and the agent skill **`docs/agents/skills/grafdev-enterprise/SKILL.md`** (also linked from root `AGENTS.md`).
