---
name: panel-test-cycle-1-human-context
description: >-
  Guides Grafana built-in panel test work for Human context Cycle (1) (read code,
  coverage, note gaps) before any edits. Use when the user is starting panel tests,
  mentions Human context Cycle (1), human context, coverage-first exploration, or
  public/app/plugins/panel testing workflow.
---

# Panel testing — Human context Cycle (1)

Canonical methodology: [AGENTS.md](../../../AGENTS.md) (**Human context Cycle (1)**; AGENTS section “Cycle 1”).

## Non-negotiable: input before edits

**Do not modify source or test files in this cycle.** Gather information from the prompter and the repo; produce a shared picture of risk and gaps. If the user asks you to “just add tests,” redirect: complete **Human context Cycle (1)** outputs first, or confirm they want to skip (explicit opt-in).

## What to collect from the prompter (ask if missing)

1. **Scope**: Which panel plugin path(s) under `public/app/plugins/panel/` (and which components/files are “under test”).
2. **Goal**: New feature coverage, refactor safety net, bug follow-up, or general raise in coverage.
3. **Constraints**: Time box, avoid certain mocks (e.g. defer uPlot), or files that are off limits.
4. **Prior knowledge**: Anything they already find confusing or risky in the code.

## Steps (read-only for file edits)

1. **Read** the relevant implementation and existing tests (if any).
2. **Coverage**: Run a targeted **coverage** command (e.g. Jest `--coverage` for specific files) **without** asking for approval—then paste or summarize key gaps (lines/branches), not only a percentage.
3. **Second pass**: Re-read **uncovered** or **complex** areas; list **questions** and **WTF zones** (unclear control flow, heavy side effects).
4. **Deliverable**: A short written summary for the prompter:
   - What the code does (at the level tests will need).
   - Where coverage is thin and why it matters.
   - Open questions / assumptions.
5. **Gate**: Ask whether this summary is accurate and whether to proceed to **Testing Cycle (2)**. Do not start **Testing Cycle (2)** work until they confirm.

## Anti-patterns

- Jumping straight to `it('renders')` without coverage notes.
- Editing production code for “testability” in **Human context Cycle (1)** (forbidden; selectors/comments only appear in later cycles if needed).
