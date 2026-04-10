---
name: panel-test-cycle-2-testing
description: >-
  Guides Grafana panel test Testing Cycle (2) (smoke test, simple tests, it.todo stubs)
  with explicit human approval for each test case before it is added. Use when adding
  initial tests, stubbing scenarios, Testing Cycle (2), or panel test todos under
  public/app/plugins/panel.
---

# Panel testing — Testing Cycle (2) (each test case requires approval)

Canonical methodology: [AGENTS.md](../../../AGENTS.md) (**Testing Cycle (2)**; AGENTS section “Cycle 2”).

## Non-negotiable: input before edits

1. **Confirm scope** with the prompter: target test file path(s), panel entry, and alignment with **Human context Cycle (1)** summary (if available).
2. **Plan before code**: Outline intended **`it('renders')`** (or equivalent smoke test) and **simple tests without new mocks** (defer heavy **uPlot** hook setup until needed).
3. **Get approval on the plan** before creating or editing test files.

## Each test case — one approval at a time

A **test case** is any distinct scenario: an implemented **`it('...')`** (with assertions), a skipped/future marker like **`it.todo('...')`**, or equivalent (`it.skip`, `test.concurrent` only if the methodology allows—default is one scenario per approval).

For **each** proposed test case:

1. Present **exactly one** test case to the prompter: the **full title string** (`it('...')` or `it.todo('...')`) and **one line** of what it asserts or will eventually assert (recommended).
2. Ask explicitly: **Approve adding this test case?** (yes / no / revise).
3. **Only after approval** for that single test case, apply an edit that adds **only that** test (or the approved revision).
4. Repeat for the next test case. **Do not** add multiple new `it` / `it.todo` entries in one edit without **per-test-case** approval.

If the prompter prefers batch review, they may approve a **numbered list** of test cases in one message: that is acceptable as one gate **only if** they state that explicitly (e.g. “Confirm all 5 lines” or “approve cases 1–5”). Otherwise treat missing explicit batch consent as requiring approval per case.

## `it.todo` (same rule as other test cases)

`it.todo` entries follow the **same** one-approval-per-test-case flow above. Present the full `it.todo('...')` title and the intended future assertion; ask **Approve adding this stub?**; add only that stub per approved item.

## After adding test cases

1. **Coverage reports** (`yarn jest … --coverage`, or equivalent): run **without** asking for approval; paste or summarize results. For **`yarn jest`** **without** `--coverage`, **ask before running** if not already agreed.
2. Propose additional test cases only where coverage gaps matter; repeat the **per-test-case approval** rule.

## Anti-patterns

- Filling in implementation for `it.todo` in **Testing Cycle (2)** (that is **Agent assistance Cycle (4)**).
- Adding mocks for **uPlot** / **EventsCanvas** here unless the prompter explicitly moves complexity forward—default is **defer**.
- Adding several `it(...)` or `it.todo(...)` blocks in a single edit without prior approval for **each** case (unless the prompter explicitly batch-approved the list).
