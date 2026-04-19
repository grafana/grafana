---
name: grafdev-enterprise
description: >-
  OSS + grafana-enterprise dev: grafdev CLI, enterprise-dev, dual-repo git,
  enterprise_imports, Wire (wireexts_oss / wireexts_enterprise—not IsEnterprise-only gates).
  Run doctor before branch/dualize/sync/ge. For sibling ../grafana-enterprise, make enterprise-dev, or cross-repo PRs.
---

# Grafana OSS + Enterprise (grafdev)

## When to use this skill

Work touches **both** OSS and **`grafana-enterprise`**, or OSS is **linked** for enterprise dev (`pkg/extensions/ext.go`, `make enterprise-dev`, `local/Makefile`). To use as a Cursor project skill, symlink or copy this dir to `.cursor/skills/grafdev-enterprise/` (see root `AGENTS.md`).

## Repo layout (typical)

- **OSS**: this repo (`github.com/grafana/grafana` in `go.mod`).
- **Enterprise**: sibling `../grafana-enterprise` (or `--enterprise` / `GRAFANA_DEV_ENTERPRISE`).

## Workflow order

**cwd is usually OSS-only**; enterprise is a sibling checkout—use `grafdev` as the outside view.

1. **`grafdev doctor`** first (optional: `verify`, `smoke`) **before** mutating git: `branch`, `dualize`, `sync --apply`, `ge git …`.
2. Then **`context`**, **`branch`**, **`dualize`**, **`sync`**, **`ge git`** as needed.
3. **OSS vs Enterprise code**: `grafdev wire patterns`—interface + `wire.Bind` in `wireexts_oss.go` / `wireexts_enterprise.go`; enterprise-only types under `pkg/extensions/...` with `//go:build enterprise || pro`. Do not use **`cfg.IsEnterprise` / `setting.IsEnterprise` alone** in one OSS type as a stand-in for that split.

## CLI: `grafdev`

From OSS root (or `--oss <path>`):

```bash
go run ./pkg/cmd/grafdev --help
```

**Git in enterprise from OSS cwd:** use **`grafdev ge git`** (or `ge run <cmd>`). Example:

```bash
go run ./pkg/cmd/grafdev --oss . ge git status -sb
```

`--oss` / `--enterprise` may appear before `ge` or right after `ge`; env `GRAFANA_DEV_OSS` / `GRAFANA_DEV_ENTERPRISE` work too.

### Subcommands (summary)

| Command                       | Purpose                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `context`                     | Resolved paths and branches                                                                               |
| `branch dual \| enterprise`   | New branches from `origin` default (`--yes`; `--reset-existing` for `switch -C`)                          |
| `dualize --yes`               | Align the repo still on default to the other’s branch name                                                |
| `doctor` / `verify` / `smoke` | Health, parity, drift, dev lock; prefer **doctor** before git mutations; `doctor --strict` fails on warns |
| `sync`                        | Drift vs default; `--apply --yes` rebase/merge/ff                                                         |
| `link status\|start\|unlock`  | enterprise-dev / `.devlock`                                                                               |
| `imports explain\|add`        | `enterprise_imports.go`                                                                                   |
| `wire patterns`               | Wire split (`wire.go`, `wireexts_oss.go`, `wireexts_enterprise.go`)                                       |

## Linking OSS ↔ enterprise

**`make enterprise-dev`** (OSS root, needs `local/Makefile`): `../grafana-enterprise/start-dev.sh`—syncs enterprise ↔ OSS. See `enterprise-dev`, `enterprise-unlock`, etc. in `local/Makefile`.

## Rules of thumb

- **Doctor before further actions** before using the grafdev tool, run doctor to validate the repo's state (Enterprise properly linked, branches aligned if needed).
- **Matching branch names** for cross-repo PRs when both repos change.
- **GE-only Go deps**: blank imports in `pkg/extensions/enterprise_imports.go` (`grafdev imports explain`).
