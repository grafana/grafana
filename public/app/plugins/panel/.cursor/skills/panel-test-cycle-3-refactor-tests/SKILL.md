---
name: panel-test-cycle-3-refactor-tests
description: >-
  Guides refactoring Grafana panel test files (describe grouping, setUp/helpers, DRY)
  with an approved plan before edits. Use when the user mentions Refactor tests Cycle (3),
  test refactor, describe blocks, setUp, or cleaning panel tests under
  public/app/plugins/panel.
---

# Panel testing — Refactor tests Cycle (3)

Canonical methodology: [AGENTS.md](../../../AGENTS.md) (**Refactor tests Cycle (3)**; AGENTS section “Cycle 3” and example).

## Non-negotiable: plan approval before edits

**Do not reorder, rename, or extract helpers until the prompter approves a written refactor plan.** Goal: `it` bodies shrink to **inputs + user actions + assertions**; shared pieces live in the **innermost shared `describe`**.

## What to collect from the prompter

1. **Target file(s)** and whether **behavior must stay identical** (refactor-only, no assertion changes) or small assertion clarifications are allowed.
2. **Naming**: preferred `describe` hierarchy (feature / sub-feature).
3. **Setup contract**: what `setUp()` (or `setup`) should return—`userEvent`, `screen`, props factory, etc.

## Proposed plan (present before any edit)

1. **Current structure** sketch: existing `describe` / `it` layout (brief).
2. **Target structure**: nested `describe` tree.
3. **Shared helpers**: signatures for `setUp()`, shared `getMarker()`-style queries, and **what moves out of each `it`**.
4. **Risk note**: any test that might change meaning when moved (flag it).

Ask: **Approve this plan?** Revise until yes.

## Execution (after approval)

1. Apply refactors in **small commits or steps**; prefer one `describe` block or one helper at a time if the file is large.
2. Run tests after each logical step; **coverage** runs (`--coverage`) **do not** require asking—run and check. **Ask before running** other test commands if the user did not request runs.
3. End state: `it` blocks read as **scenarios**; duplication removed without hiding important variation.

## Anti-patterns

- “Cleaning up” production code in **Refactor tests Cycle (3)**—**avoid**; test-only refactors here.
- Changing assertion meaning while “renaming” tests without prompter sign-off.
