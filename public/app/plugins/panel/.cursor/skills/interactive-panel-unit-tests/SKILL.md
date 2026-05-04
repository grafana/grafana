---
name: interactive-panel-unit-tests
description: >-
  Meta-orchestration for Grafana built-in panel testing across six methodology cycles
  (Human context Cycle (1) through Agent assistance Cycle (4), then Regression tests
  Cycle (5), then Review Cycle (6)). Use when running the full panel test workflow with
  separate agents per cycle, serial execution, loop-back reuse rules, and context-based
  agent refresh under public/app/plugins/panel.
---

# Interactive panel unit tests — six cycles, dedicated agents, serial execution

Canonical methodology: [AGENTS.md](../../../AGENTS.md) — use the **Human context Cycle (1)** … **Review Cycle (6)** names in the table below (AGENTS.md still uses its own section titles **“Cycle 1”** … **“Cycle 5”** plus **Regression tests**).

This skill does **not** replace the per-cycle skills; it defines **how to assign and reuse Cursor agents (threads)** across those cycles.

## The six cycles

| Methodology cycle          | Focus            | Skill (`panel/.cursor/skills/`)                                                                                                                                                                                                |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Human context Cycle (1)    | Human context    | [`panel-test-cycle-1-human-context`](../panel-test-cycle-1-human-context/SKILL.md)                                                                                                                                             |
| Testing Cycle (2)          | Testing          | [`panel-test-cycle-2-testing`](../panel-test-cycle-2-testing/SKILL.md)                                                                                                                                                         |
| Refactor tests Cycle (3)   | Refactor tests   | [`panel-test-cycle-3-refactor-tests`](../panel-test-cycle-3-refactor-tests/SKILL.md)                                                                                                                                           |
| Agent assistance Cycle (4) | Agent assistance | [`panel-test-cycle-4-agent-assistance`](../panel-test-cycle-4-agent-assistance/SKILL.md)                                                                                                                                       |
| Regression tests Cycle (5) | Regression tests | [`panel-test-cycle-5-github-regression-hunt`](../panel-test-cycle-5-github-regression-hunt/SKILL.md) (GitHub discovery) **then** [AGENTS.md § Regression tests](../../../AGENTS.md) (revert-fix confirmation, implementation). |
| Review Cycle (6)           | Review           | [`panel-test-cycle-6-review`](../panel-test-cycle-6-review/SKILL.md)                                                                                                                                                           |

At the **start** of a full panel-test effort, **plan for six dedicated agents** (six separate chats/threads), one per cycle above. **Name or label** them consistently (e.g. `Human context Cycle (1)` … `Review Cycle (6)`) so loop-backs are unambiguous.

### Regression tests Cycle (5) — two-part skill order (serial)

Within the **same** Regression tests Cycle (5) agent (unless replaced at 60% context), run **in order**:

1. **[`panel-test-cycle-5-github-regression-hunt`](../panel-test-cycle-5-github-regression-hunt/SKILL.md)**: Prompt the prompter to search GitHub for related merged bugfixes that may lack tests; **always return** full **`https://github.com/grafana/grafana/pull/...`** and **`.../issues/...`** links (never number-only); **ask** whether they want a regression test for each candidate.
2. **[AGENTS.md — Regression tests](../../../AGENTS.md)**: For any candidate they accept, follow revert-fix / targeted regression steps and implement in the appropriate test layer.

## Non-negotiable: series execution

- Run cycles **in order** when moving forward: **Human context Cycle (1) → Testing Cycle (2) → Refactor tests Cycle (3) → Agent assistance Cycle (4) → Regression tests Cycle (5) → Review Cycle (6)**.
- **Do not** run two methodology cycles **in parallel** (no concurrent agents both “doing **Testing Cycle (2)** and **Agent assistance Cycle (4)**” on the same effort). Finish the current cycle’s exit criteria before opening the next cycle’s agent for new work.
- It is fine for **Regression tests Cycle (5)** to be **skipped** if there is no regression scenario; document that skip explicitly.

## Loop-backs: reuse the same cycle’s agent

Work often **returns** to an earlier cycle (e.g. **Review Cycle (6)** finds gaps → back to **Testing Cycle (2)** or **Refactor tests Cycle (3)**).

When re-entering a methodology cycle:

1. **Default**: Resume the **same dedicated agent** you created for that cycle (the chat/thread assigned to it). Paste a short **handoff** (what changed, what to do next) so that agent stays aligned with its cycle skill and prior decisions.
2. **Exception — context threshold**: If that agent’s **context window usage is at or above 60%**, do **not** continue stuffing that thread. **Retire** that agent for that cycle, then **create a new agent** for that methodology cycle only:
   - Attach the same cycle skill(s) as before (see table above; **Regression tests Cycle (5)** includes **both** [`panel-test-cycle-5-github-regression-hunt`](../panel-test-cycle-5-github-regression-hunt/SKILL.md) and [AGENTS.md regression](../../../AGENTS.md) when redoing that cycle).
   - Provide a **fresh handoff**: scope, branch, paths, open `it.todo` items, and any decisions from the retired thread that must survive.

### Estimating “60%”

Use the **Cursor UI context indicator** for the thread, if shown. If no meter is visible, treat **long transcripts**, **many large pastes**, or **sluggish replies** as a signal to **prefer a fresh agent for that methodology cycle** rather than risking lossy truncation—aligned with [AGENTS.md](../../../AGENTS.md) guidance on high context usage.

## Orchestration checklist (for the prompter or lead agent)

1. **Create** six cycle-dedicated agents (or create **Human context Cycle (1)** first and add others as you reach each forward step—still **one agent per cycle**, no doubling).
2. **Forward path**: only the agent for the **current** cycle does that cycle’s work; others stay idle until their turn.
3. **Loop-back**: switch to the **target cycle’s** dedicated agent; check context **before** sending large new instructions—if **≥ 60%**, **replace** that cycle’s agent and hand off.
4. **Regression tests Cycle (5)** then **Review Cycle (6)**: use the Regression tests Cycle (5) agent for **`panel-test-cycle-5-github-regression-hunt`** (prompt GitHub search, PR/issue links, ask about regression tests) and **AGENTS.md** regression steps for accepted items; then use the Review Cycle (6) agent for **`panel-test-cycle-6-review`** (draft PR, diff read, coverage sanity). Time-box or reorder only if the team agrees.

## Anti-patterns

- Running multiple cycles at once on the same panel effort “to save time.”
- Using a **single** agent for all six cycles when the methodology expects **separate** cycle agents (this skill is built for **six** threads).
- Looping back to an earlier methodology cycle in a **different** agent without cause, when the original thread for that cycle is still **below 60%** context—unnecessarily splits state.
- Ignoring the 60% rule and continuing in a **full** thread for that cycle—risks dropped context and inconsistent output.
