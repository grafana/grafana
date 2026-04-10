---
name: panel-test-cycle-4-agent-assistance
description: >-
  Implements Grafana panel tests for one approved stub or scenario at a time (Cycle 4),
  with review between iterations. Use when filling it.todo, agent-assisted test
  implementation, or Cycle 4 under public/app/plugins/panel.
---

# Panel testing — Cycle 4: Agent assistance

Canonical methodology: [public/app/plugins/panel/AGENTS.md](../../../public/app/plugins/panel/AGENTS.md) (sections “Cycle 4”, “Technical reference”, “Layered tests”, “uPlot plugin patterns”).

## Input before implementation

1. **Confirm target**: one **`it.todo`** (or one missing test) to implement—**only one** per focused session unless the prompter lists several and asks for a batch.
2. **Confirm patterns**: point to **existing tests in the same file or sibling panels** the implementation should mirror (`getPanelProps`, `userEvent.setup`, mocks).
3. **Ask** whether production changes are allowed **only** for `data-testid`, selectors, or comments (default per AGENTS.md).

## Implementation rules

1. Replace **`it.todo`** with a real test **or** split into `it` + helpers; follow [contribute/style-guides/testing.md](../../../contribute/style-guides/testing.md) for RTL/user-event.
2. Use panel patterns from AGENTS.md: **`getPanelProps`**, `*.integration.test.tsx` + mocked **uPlot** when hooks matter, fake **UPlotConfigBuilder** per existing panel examples.
3. **Stop after one scenario** is done: show the diff summary and ask whether to **commit** before the next `it.todo`.

## If wrong or messy

- **Wrong**: debug, fix test or (minimally) production selectors; re-run tests with user approval for commands.
- **Messy**: refactor **tests only** (Cycle 3-style) in a follow-up, or ask the prompter if they want a Cycle 3 pass.

## Anti-patterns

- Implementing multiple todos in one go without explicit prompter request.
- Broad production refactors to “make tests easier” without explicit approval.
