---
name: grafdev-enterprise
description: >-
  Grafana OSS plus grafana-enterprise local development: grafdev CLI, make
  enterprise-dev, dual-repo git, enterprise_imports, and Wire OSS/enterprise
  splits. Use when the user or task involves Grafana Enterprise, sibling repo
  ../grafana-enterprise, make enterprise-dev, enterprise wire, enterprise_imports,
  dual-repo branches, or syncing OSS with enterprise.
---

# Grafana OSS + Enterprise (grafdev)

## When to use this skill

Apply when work touches **both** `grafana` (OSS) and **`grafana-enterprise`**, or when the OSS tree is **linked** for enterprise dev (`pkg/extensions/ext.go`, `make enterprise-dev`, `local/Makefile`).

This file lives under `docs/agents/skills/` (committed) because `.cursor/` is gitignored in this repo; it is linked from root **`AGENTS.md`**. To register it as a Cursor **project** skill in your clone, copy or symlink this directory to `.cursor/skills/grafdev-enterprise/` locally if your team uses that layout.

## Repo layout (typical)

- **OSS**: this repository (`github.com/grafana/grafana` in `go.mod`).
- **Enterprise**: sibling checkout `../grafana-enterprise` (or override with `--enterprise` / `GRAFANA_DEV_ENTERPRISE`).

## CLI: `grafdev`

Run from OSS root (or pass `--oss`):

```bash
go run ./pkg/cmd/grafdev --help
```

### Git in enterprise from OSS cwd (agents)

Agents often have shell cwd = OSS only. Use **`grafdev ge git`** so git runs with **`cwd = grafana-enterprise`**:

```bash
go run ./pkg/cmd/grafdev --oss . ge git status -sb
go run ./pkg/cmd/grafdev --oss . ge git rev-parse HEAD
go run ./pkg/cmd/grafdev --oss . ge git checkout -b my-branch
```

Put **global flags before `ge`**: `grafdev --oss <path> ge git …`

**Any command** in the enterprise tree:

```bash
go run ./pkg/cmd/grafdev --oss . ge run git log -1 --oneline
```

### Environment (no `--oss` in cwd)

```text
GRAFANA_DEV_OSS=/abs/path/to/grafana
GRAFANA_DEV_ENTERPRISE=/abs/path/to/grafana-enterprise   # optional override
```

### Other subcommands (summary)

| Command                       | Purpose                                                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `context`                     | Resolved paths and current branches                                                                                                             |
| `branch dual \| enterprise`   | New branches from remote default (`--yes`); `--reset-existing` to allow `git switch -C` when the branch already exists                          |
| `dualize --yes`               | Align branch on the repo still on default; `--reset-existing` if that branch name already exists locally; `--force` only skips dirty-tree check |
| `doctor` / `verify` / `smoke` | Health and `make -n enterprise-dev`; `doctor --strict` exits non-zero on warnings                                                               |
| `sync`                        | Drift vs remote default; `--apply --yes` to rebase/merge/ff (clean tree required unless `--force`)                                              |
| `link status\|start\|unlock`  | enterprise-dev / `.devlock`                                                                                                                     |
| `imports explain\|add`        | `enterprise_imports.go`                                                                                                                         |
| `wire patterns`               | Wire file split reminder                                                                                                                        |

## Linking OSS ↔ enterprise

- **`make enterprise-dev`** (from OSS, requires `local/Makefile`): runs `../grafana-enterprise/start-dev.sh` — copies enterprise → OSS, watches paths, syncs changes back. See `local/Makefile` targets `enterprise-dev`, `enterprise-unlock`, etc.

## Rules of thumb

- **Matching branch names** for cross-repo PRs when both repos change.
- **GE-only Go deps**: blank imports in `pkg/extensions/enterprise_imports.go` (`grafdev imports explain`).
- **Wire**: OSS vs enterprise sets in `pkg/server/wireexts_oss.go` / `wireexts_enterprise.go` (`grafdev wire patterns`).
