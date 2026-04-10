---
name: panel-test-cycle-2-testing
description: >-
  Guides Grafana panel test Cycle 2 (smoke test, simple tests, it.todo stubs) with
  explicit human approval for each it.todo before it is written. Use when adding
  initial tests, stubbing scenarios, Cycle 2, or panel test todos under public/app/plugins/panel.
---

# Panel testing — Cycle 2: Testing (stubs require approval)

Canonical methodology: [AGENTS.md](../../../AGENTS.md) (section “Cycle 2”).

## Non-negotiable: input before edits

1. **Confirm scope** with the prompter: target test file path(s), panel entry, and alignment with Cycle 1 summary (if available).
2. **Plan before code**: Outline intended **`it('renders')`** (or equivalent smoke test) and **simple tests without new mocks** (defer heavy **uPlot** hook setup until needed).
3. **Get approval on the plan** before creating or editing test files.

## `it.todo` — one approval at a time

For **each** proposed `it.todo` (or equivalent skipped/future test marker):

1. Present **exactly one** stub to the prompter: the **full `it.todo('...')` title string** and **one line** of what behavior it will eventually assert (optional but recommended).
2. Ask explicitly: **Approve adding this stub?** (yes / no / revise).
3. **Only after approval** for that single stub, apply an edit that adds **only that** `it.todo` (or the approved revision).
4. Repeat for the next stub. **Do not** add multiple new `it.todo` entries in one edit without **per-stub** approval.

If the user prefers batch review, they may approve a **numbered list** of stubs in one message: still confirm **each line** in the list is approved (e.g. “Confirm all 5 lines” is acceptable as one gate **only if** they state that explicitly).

## After stubs

1. Run or suggest **`yarn jest path/to/file.test.tsx --no-watch --watchAll=false`** (and coverage if requested). **Ask before running** if not already agreed.
2. Propose additional stubs only where coverage gaps matter; repeat the **per-`it.todo` approval** rule.

## Anti-patterns

- Filling in implementation for `it.todo` in Cycle 2 (that is **Cycle 4**).
- Adding mocks for **uPlot** / **EventsCanvas** here unless the prompter explicitly moves complexity forward—default is **defer**.
