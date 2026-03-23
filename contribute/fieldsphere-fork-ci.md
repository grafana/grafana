# Fieldsphere Grafana fork — CI and upstream sync

This repository fork uses a **minimal GitHub Actions workflow** ([`.github/workflows/fieldsphere-ci.yml`](../.github/workflows/fieldsphere-ci.yml)) so CI runs on standard `ubuntu-latest` runners without Grafana-internal Vault, org runner pools, or upstream release automation.

## What runs in CI

- **Backend:** `CGO_ENABLED=0 go test -short -timeout=40m ./...` from the repo root (Go workspace).
- **Frontend:** `yarn run prettier:check`, `yarn run lint`, then `yarn workspace @grafana/data themes-schema` (generates `schema.generated.json`, which is gitignored but required by `tsc`), then `yarn run typecheck`. Typecheck uses `NODE_OPTIONS=--max-old-space-size=6144` so `tsc` / Nx do not hit the default heap limit on standard runners.

Fork-local paths (`.cursor/`, `.vscode/`, and root `manifest.json`) are listed in [`.prettierignore`](../.prettierignore) so `prettier:check` matches upstream expectations without formatting IDE tooling.

## Red checks on the _first_ minimal-CI pull request

GitHub runs `pull_request_target` workflows from the **target branch** (`main`), not from the PR branch. Until `main` contains this fork’s slim workflow set, **old** workflows on `main` can still run (changelog policy, external PR labelling, auto-milestone, and similar) and may fail or be irrelevant.

**Ways to get green:**

1. **Preferred:** Merge the minimal-CI PR using an **admin bypass** of required checks (one-time). After that, `main` loads this fork’s files under [`.github/workflows/`](../.github/workflows/), including the no-op [`.github/workflows/pr-commands.yml`](../.github/workflows/pr-commands.yml) (replaces Grafana **PR automation**) and [`.github/workflows/fieldsphere-ci.yml`](../.github/workflows/fieldsphere-ci.yml).
2. **Temporary:** In **Settings → Actions**, disable the specific legacy workflows you do not want, or remove them as required checks in branch protection until the merge lands.

### PR automation (`pull_request_target`)

Upstream **PR automation** calls internal Grafana Actions and fails on this fork. The real YAML is kept in [`.github/workflows-upstream-archive/pr-commands.yml`](../.github/workflows-upstream-archive/pr-commands.yml). Active [`.github/workflows/pr-commands.yml`](../.github/workflows/pr-commands.yml) is a **stub** with the same workflow name and triggers so the check succeeds once that file is on `main` (after merge). Until merge, `main` still runs the old workflow definition.

## Where the old workflows went

Upstream workflow files were moved to [`.github/workflows-upstream-archive/`](../.github/workflows-upstream-archive/). GitHub **only** loads workflows from `.github/workflows/*.yml` (and `*.yaml`); the archive is for reference when resolving merges from `grafana/grafana`.

Non-workflow assets that used to live next to workflows (for example [`.github/workflows/scripts/`](../.github/workflows/scripts/)) were left in place; they are inert unless something references them.

## Merging from `grafana/grafana`

Expect **large conflicts** under `.github/workflows/` when you merge or rebase onto upstream `main`.

**Resolution rule:** Keep the fork’s minimal setup:

1. Preserve [`.github/workflows/fieldsphere-ci.yml`](../.github/workflows/fieldsphere-ci.yml) (or re-apply it after the merge).
2. Do **not** restore the full upstream workflow set into `.github/workflows/` unless you intend to return to upstream CI (and then fix runners, Vault, and branch protection accordingly).
3. If you want upstream YAML for comparison, copy new/changed files into `.github/workflows-upstream-archive/` instead of activating them.

## GitHub settings (branch protection)

After this workflow is on your default branch:

1. Open **Settings → Rules** (or **Branches → Branch protection**) for `main`.
2. Remove required status checks that pointed at **removed** jobs (for example old matrix shards or Grafana-specific names).
3. Add required checks that match **Fieldsphere CI** job names in GitHub’s picker, for example:
   - `Backend unit tests (short)`
   - `Frontend lint and typecheck`

Names must match what the Actions UI shows for the workflow run (they use the `name:` field on each job).

4. Confirm **Actions** is enabled for the repo. There should be **no** scheduled workflows left under `.github/workflows/` in this fork, so nothing should run on a cron from this directory.
