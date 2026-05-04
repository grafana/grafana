---
name: panel-test-cycle-5-github-regression-hunt
description: >-
  Regression tests Cycle (5) — prompts searching GitHub (grafana/grafana) for related
  bugfix PRs that may lack test coverage; always return full HTTPS links for every PR
  and issue candidate; ask whether to add a regression test. Use with panel test meta
  workflow, regression discovery, or public/app/plugins/panel.
---

# Panel testing — Regression tests Cycle (5): GitHub bugfix regression candidates

**AGENTS.md** still lists regression discovery under **Regression tests** (not renumbered). Canonical follow-up: [AGENTS.md](../../../AGENTS.md) (**Regression tests**).

This skill is **discovery and triage**: it does **not** replace writing tests—that happens per AGENTS and [panel-test-cycle-4-agent-assistance](../panel-test-cycle-4-agent-assistance/SKILL.md) when the prompter opts in.

## Non-negotiable: prompt the prompter to search GitHub

**Do not skip the human search step.** The agent should **prompt and guide** the prompter to run GitHub searches (browser or `gh` CLI). Automated scraping of GitHub is optional only if tooling is already available and allowed; default is **explicit prompter-led search** with queries you supply.

## What to collect from the prompter first (ask if missing)

1. **Scope**: Panel plugin path(s) under `public/app/plugins/panel/` (or component names) tied to the current test effort.
2. **Keywords**: Feature names, bug symptoms, file or plugin identifiers useful for search (e.g. `timeseries`, `ThresholdControls`, issue numbers they already know).

## Steps

1. **Propose search queries** for **github.com/grafana/grafana** (or GitHub’s search UI), for example:
   - `repo:grafana/grafana is:pr is:merged label:bug <scope-keyword>`
   - `repo:grafana/grafana is:pr is:merged <path-segment> bug fix`
   - Refine by path: use the **Files changed** filter or search for strings that appear in the panel directory.
2. **Prompt the prompter** to run those searches (and adjacent issue search: `is:issue label:bug` with the same keywords) and paste back anything that looks like a **bugfix without new/updated tests** in the PR diff.
3. For **each candidate** the prompter confirms (or that you help shortlist), **deliver to the prompter**:
   - **Pull request**: **Always** include the full HTTPS URL on its own (copy-pasteable), e.g. `https://github.com/grafana/grafana/pull/<number>`. Never substitute bare `#123` or `PR 123` without the URL in the same deliverable.
   - **Linked issue** (if available): **Always** include the full HTTPS URL when an issue exists, e.g. `https://github.com/grafana/grafana/issues/<number>`. If none is linked, say **no linked issue found** and still keep the PR URL above.
4. **Ask explicitly** (per candidate, or once for a batch): _Do you want to add a regression test that would fail if this bug came back?_ If yes, point them to AGENTS **Regression tests** (revert fix locally → test fails → restore fix) and the right test layer for that code path.

## Deliverable format

Use a small table or bullet list so the prompter can scan. **Every row must use full `https://github.com/grafana/grafana/...` URLs** in the PR column (and Issue column when applicable)—never only issue/PR numbers.

| Candidate                               | PR (full URL, always)                           | Issue (full URL or —)                                  |
| --------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Short label (e.g. “threshold drag bug”) | `https://github.com/grafana/grafana/pull/12345` | `https://github.com/grafana/grafana/issues/67890` or — |

Also acceptable: a **bulleted list** where each bullet repeats the candidate label and **embeds or follows with the PR URL** (and issue URL if any), so nothing is number-only.

End with the **question**: which items (if any) should become regression-test work in this branch.

## Anti-patterns

- Claiming “no related PRs” without **prompting** the prompter to search and paste results.
- Listing candidates with **only** `#123`, `PR #456`, or `grafana/grafana#789` **without** the matching **`https://github.com/grafana/grafana/pull/...`** or **`.../issues/...`** link in the same response.
- Implementing regression tests in this skill without the prompter **opting in** after the question above.
