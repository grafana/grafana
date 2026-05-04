---
name: panel-test-cycle-6-review
description: >-
  Review Cycle (6) — final review for Grafana panel test work (draft PR, diff read,
  typecheck, ESLint, Prettier, coverage sanity, optional second review). Use when the
  user mentions Review Cycle (6), PR review, test coverage review, or finishing panel
  tests under public/app/plugins/panel.
---

# Panel testing — Review Cycle (6)

Canonical methodology: [AGENTS.md](../../../AGENTS.md) (**Review Cycle (6)** in this meta workflow; AGENTS labels that section **“Cycle 5”** — review; AGENTS section titles are unchanged).

## Input before “LGTM”

Ask the prompter for:

1. **PR URL or branch name** (if not in context)—to read the full diff in GitHub or locally.
2. **Focus areas**: behavior risk, flakiness worries, or files they want extra scrutiny.

**Coverage**: You may run **coverage** again **without** asking for approval; align paths with the PR/diff scope when obvious, or infer from changed test files.

## Tooling checks (repo root)

Run these from the **Grafana repo root** before treating the branch as merge-ready. **Do not** ask for approval to run them—**fix failures** (or report them) before LGTM.

1. **TypeScript**: `yarn typecheck`
2. **ESLint**: `yarn lint` (use `yarn lint:fix` where auto-fixes apply)
3. **Prettier**: `yarn prettier:check` — if it fails, run **`yarn prettier:write`** on the changed files (or the paths from the PR scope), then re-run `yarn prettier:check`

Aligns with repo-wide commands in [AGENTS.md](../../../../../../../AGENTS.md).

## Review checklist

1. **Diff narrative**: Do tests match what they claim? Names align with data and UI (see AGENTS “Naming and clarity”).
2. **Layering**: Unit vs integration vs pure logic files respected; no asserting DOM inside mocks that do not render it.
3. **Security**: No unsafe patterns in tests (Frontend Security Rule).
4. **Coverage**: Ignore headline percentage; note **uncovered high-WTF blocks** (complex, churn-prone, or failure-prone).

## Optional second pass

- Suggest **another reviewer or agent** on the branch if the change is large or high risk—**ask** if they want that.

## Anti-patterns

- Approving without reading the full test diff.
- Skipping **`yarn typecheck`**, **`yarn lint`**, or **`yarn prettier:check`** when the branch is meant to merge (CI will fail the same checks).
- Demanding 100% coverage instead of targeting meaningful gaps.
