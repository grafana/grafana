# How to test `grafdev` (manual)

Keep this file aligned with CLI behavior: `main.go`, `commands/` (subcommands), and `base/` (paths, git, flags, devlock).

## Path resolution (`--oss`, `--enterprise`, env)

- **Default:** From a directory **inside** the OSS repo, `grafdev` walks parents until it finds `go.mod` with `module github.com/grafana/grafana`. Enterprise defaults to **`../grafana-enterprise`** next to that OSS root.
- **`--oss`:** Use when your shell **cwd is not** under the OSS checkout (agents, `/tmp`, etc.).
- **`--enterprise`:** Use when the enterprise checkout is **not** the default sibling path (custom layout, renamed folder, extra clone).
- **Env:** `GRAFANA_DEV_OSS` and `GRAFANA_DEV_ENTERPRISE` are wired as flag `EnvVars` and are also read in path helpers when flags are empty.

For **`ge`** only, `--oss` / `--enterprise` may appear **either** on the root command **or** immediately after `ge` (same flags are registered on both).

Examples below use `go run ./pkg/cmd/grafdev` from the OSS repo root; you can `go build -o /tmp/grafdev ./pkg/cmd/grafdev` and substitute `/tmp/grafdev` if you prefer.

---

## 1. Prerequisites

- Grafana OSS clone with `local/Makefile` and enterprise linked (`pkg/extensions/ext.go` present) if you want full `doctor` / `verify` / `smoke` success.
- Sibling **`../grafana-enterprise`** (or `--enterprise` / `GRAFANA_DEV_ENTERPRISE` when layout differs).
- **`git`**, **`make`**, and for full watcher flow whatever **`start-dev.sh`** needs (e.g. **`fswatch`** on macOS, **`rsync`**).

---

## 2. Build and help

From **OSS repo root** (no path flags needed):

```bash
cd /path/to/grafana
go run ./pkg/cmd/grafdev --help
go run ./pkg/cmd/grafdev context
```

From **outside** the repo, pass OSS (and enterprise if non-default):

```bash
go run ./pkg/cmd/grafdev --oss /path/to/grafana context
go run ./pkg/cmd/grafdev --oss /path/to/grafana --enterprise /path/to/grafana-enterprise context
```

---

## 3. Read-only checks (safe)

```bash
go run ./pkg/cmd/grafdev doctor
go run ./pkg/cmd/grafdev doctor --strict   # non-zero exit if any [warn]
go run ./pkg/cmd/grafdev verify            # exits non-zero if layout is wrong; good for scripts
go run ./pkg/cmd/grafdev smoke             # verify + dry-run: make -n enterprise-dev
go run ./pkg/cmd/grafdev link status   # .devlock line uses same ps-based classification as doctor
go run ./pkg/cmd/grafdev imports explain
go run ./pkg/cmd/grafdev wire patterns
```

**`doctor` and `.devlock`:** If `../grafana-enterprise/.devlock` exists, the doctor inspects **`ps`**:

- **`[ok]`** watcher looks active (expected while `make enterprise-dev` is running).
- **`[warn]`** lock present but no matching `fswatch` / `inotifywait` / `start-dev.sh` line → treat as **stale** (`grafdev link unlock` or `make enterprise-unlock`).
- **`[ok]`** with an explanatory line if **`ps`** could not be classified (not a strict failure unless other warns fire).

---

## 4. Git mutating commands (use a throwaway branch)

Do **not** use `--yes` on your real default branch unless you intend to reset branches (`branch` uses `git switch -C`).

```bash
git checkout -b grafdev-cli-test
# Optional: match enterprise branch for dual-repo play
cd ../grafana-enterprise && git checkout -b grafdev-cli-test && cd -

go run ./pkg/cmd/grafdev branch dual my-test-feature --yes --remote origin
# Inspect both repos; delete test branches when done
```

**`dualize`** (clean worktrees, or add `--force`):

```bash
# Example: OSS on feature/x, enterprise on remote default branch
go run ./pkg/cmd/grafdev dualize --yes --remote origin
```

---

## 5. Sync (optional)

```bash
go run ./pkg/cmd/grafdev sync --remote origin                    # plan only
go run ./pkg/cmd/grafdev sync --apply --yes --strategy rebase   # after confirming output
```

---

## 6. `imports add` (optional)

```bash
go run ./pkg/cmd/grafdev imports explain
# Only if you really want to edit the file:
go run ./pkg/cmd/grafdev imports add 'example.com/foo/bar' --yes
go fmt ./pkg/extensions/...
```

---

## 7. Link / enterprise-dev (interactive)

```bash
go run ./pkg/cmd/grafdev link start   # runs: make enterprise-dev (foreground; Ctrl+C stops watcher per start-dev.sh)
```

Or use **`make enterprise-dev`** directly. **`grafdev link unlock`** removes **`.devlock`** in `grafana-enterprise` when the lock is stale.

---

## 8. Unit tests

```bash
go test ./pkg/cmd/grafdev/...
go vet ./pkg/cmd/grafdev/...
```

---

## 9. Quick-build path (slow)

```bash
go run ./pkg/cmd/grafdev doctor --quick-build
```

Runs an enterprise-tagged `go build` of `pkg/cmd/grafana`; can take a while on a cold cache.

---

## 10. Enterprise repo proxy (`ge`)

Runs **`git`** (or another program) with **`Dir` = grafana-enterprise** so you do not need `cd ../grafana-enterprise` for every command.

**From OSS root** (paths inferred):

```bash
go run ./pkg/cmd/grafdev ge git rev-parse --show-toplevel
go run ./pkg/cmd/grafdev ge git status -sb
```

**Explicit OSS path** — either place flags **before** `ge` or **right after** `ge`:

```bash
go run ./pkg/cmd/grafdev --oss /path/to/grafana ge git status -sb
go run ./pkg/cmd/grafdev ge --oss /path/to/grafana git status -sb
```

**Arbitrary command** in the enterprise tree:

```bash
go run ./pkg/cmd/grafdev ge run git log -1 --oneline
```

**Env (optional):**

```text
GRAFANA_DEV_OSS=/abs/path/to/grafana
GRAFANA_DEV_ENTERPRISE=/abs/path/to/grafana-enterprise
```

Do **not** put `--oss` **after** `git` (those tokens are forwarded to `git`).
