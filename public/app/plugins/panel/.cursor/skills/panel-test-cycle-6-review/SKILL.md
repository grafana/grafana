---
name: panel-test-cycle-6-review
description: >-
  Meta cycle 6 — final review for Grafana panel test work (draft PR, diff read,
  coverage sanity, optional second review). Use when the user mentions meta Cycle 6,
  PR review, test coverage review, or finishing panel tests under
  public/app/plugins/panel.
---

# Panel testing — Meta cycle 6: Review

Canonical methodology: [AGENTS.md](../../../AGENTS.md) (section **“Cycle 5”** — review; AGENTS cycle numbers are unchanged).

## Input before “LGTM”

Ask the prompter for:

1. **PR URL or branch name** (if not in context)—to read the full diff in GitHub or locally.
2. **Focus areas**: behavior risk, flakiness worries, or files they want extra scrutiny.

**Coverage**: You may run **coverage** again **without** asking for approval; align paths with the PR/diff scope when obvious, or infer from changed test files.

## Review checklist

1. **Diff narrative**: Do tests match what they claim? Names align with data and UI (see AGENTS “Naming and clarity”).
2. **Layering**: Unit vs integration vs pure logic files respected; no asserting DOM inside mocks that do not render it.
3. **Security**: No unsafe patterns in tests (Frontend Security Rule).
4. **Coverage**: Ignore headline percentage; note **uncovered high-WTF blocks** (complex, churn-prone, or failure-prone).

## Optional second pass

- Suggest **another reviewer or agent** on the branch if the change is large or high risk—**ask** if they want that.

## Anti-patterns

- Approving without reading the full test diff.
- Demanding 100% coverage instead of targeting meaningful gaps.
