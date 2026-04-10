---
name: panel-test-meta-6-cycles
description: >-
  Meta-orchestration for Grafana built-in panel testing across six methodology cycles
  (1–5 plus regression). Use when running the full panel test workflow with separate
  agents per cycle, serial execution, loop-back reuse rules, and context-based agent
  refresh under public/app/plugins/panel.
---

# Panel testing — Meta: six cycles, dedicated agents, serial execution

Canonical methodology: [AGENTS.md](../../../AGENTS.md) (methodology cycles 1–5 and **Regression tests**).

This skill does **not** replace the per-cycle skills; it defines **how to assign and reuse Cursor agents (threads)** across those cycles.

## The six cycles

| Cycle | Focus | Dedicated skill (repo root `.cursor/skills/`) |
| ----- | ----- | ----------------------------------------------- |
| 1 | Human context | [`panel-test-cycle-1-human-context`](../../../../../../../.cursor/skills/panel-test-cycle-1-human-context/SKILL.md) |
| 2 | Testing | [`panel-test-cycle-2-testing`](../../../../../../../.cursor/skills/panel-test-cycle-2-testing/SKILL.md) |
| 3 | Refactor tests | [`panel-test-cycle-3-refactor-tests`](../../../../../../../.cursor/skills/panel-test-cycle-3-refactor-tests/SKILL.md) |
| 4 | Agent assistance | [`panel-test-cycle-4-agent-assistance`](../../../../../../../.cursor/skills/panel-test-cycle-4-agent-assistance/SKILL.md) |
| 5 | Review | [`panel-test-cycle-5-review`](../../../../../../../.cursor/skills/panel-test-cycle-5-review/SKILL.md) |
| 6 | Regression tests | No separate skill—follow [AGENTS.md § Regression tests](../../../AGENTS.md) (revert-fix confirmation, targeted regression cases). |

At the **start** of a full panel-test effort, **plan for six dedicated agents** (six separate chats/threads), one per cycle above. **Name or label** them consistently (e.g. `panel-tests C1` … `panel-tests C6`) so loop-backs are unambiguous.

## Non-negotiable: series execution

- Run cycles **in order** when moving forward: **1 → 2 → 3 → 4 → 5 → 6**.
- **Do not** run two methodology cycles **in parallel** (no concurrent agents both “doing Cycle 2 and Cycle 4” on the same effort). Finish the current cycle’s exit criteria before opening the next cycle’s agent for new work.
- It is fine for Cycle 6 to be **skipped** if there is no regression scenario; document that skip explicitly.

## Loop-backs: reuse the same cycle’s agent

Work often **returns** to an earlier cycle (e.g. Cycle 5 finds gaps → back to Cycle 2 or 3).

When re-entering cycle **N**:

1. **Default**: Resume the **same dedicated agent** you created for cycle **N** (the chat/thread assigned to that cycle). Paste a short **handoff** (what changed, what to do next) so that agent stays aligned with its cycle skill and prior decisions.
2. **Exception — context threshold**: If that agent’s **context window usage is at or above 60%**, do **not** continue stuffing that thread. **Retire** that agent for cycle N, then **create a new agent** for cycle N only:
   - Attach the same cycle skill as before (see table above).
   - Provide a **fresh handoff**: scope, branch, paths, open `it.todo` items, and any decisions from the retired thread that must survive.

### Estimating “60%”

Use the **Cursor UI context indicator** for the thread, if shown. If no meter is visible, treat **long transcripts**, **many large pastes**, or **sluggish replies** as a signal to **prefer a fresh cycle-N agent** rather than risking lossy truncation—aligned with [AGENTS.md](../../../AGENTS.md) guidance on high context usage.

## Orchestration checklist (for the prompter or lead agent)

1. **Create** six cycle-dedicated agents (or create cycle 1 first and add others as you reach each forward step—still **one agent per cycle**, no doubling).
2. **Forward path**: only the agent for the **current** cycle does that cycle’s work; others stay idle until their turn.
3. **Loop-back**: switch to the **target cycle’s** dedicated agent; check context **before** sending large new instructions—if **≥ 60%**, **replace** that cycle’s agent and hand off.
4. **Regression (cycle 6)**: use the cycle-6 agent with AGENTS.md regression steps; keep it **after** Cycle 5 unless the team explicitly time-boxes regression earlier.

## Anti-patterns

- Running multiple cycles at once on the same panel effort “to save time.”
- Using a **single** agent for all six cycles when the methodology expects **separate** cycle agents (this meta skill is built for **six** threads).
- Looping back to cycle N in a **different** agent without cause, when the original cycle-N thread is still **below 60%** context—unnecessarily splits state.
- Ignoring the 60% rule and continuing in a **full** cycle-N thread—risks dropped context and inconsistent output.
