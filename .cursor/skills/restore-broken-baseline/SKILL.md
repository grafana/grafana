---
name: restore-broken-baseline
description: Restore this workspace to the known broken baseline for the dotted-identifier bug on fix/influx-dotted-identifiers. Use after an investigation or fix cycle to reset the working tree and clean up leftover work. Restore only — never implement or re-apply product changes.
---

# Restore workspace to the known broken baseline

This workspace tracks a known-broken state of SQL/Influx dotted-identifier
handling on the branch `fix/influx-dotted-identifiers`. After a fix cycle,
run this skill to put the working tree back to that baseline and tidy up.

This skill is restore-only. Do not fix the identifier bug, do not cherry-pick
the fix commit, and do not make any other product change while running it.

## Baseline refs

Resolve refs in this order:

1. Git tags (preferred):
   - `dotted-identifiers/baseline` — the known broken tree (restore target)
   - `dotted-identifiers/fix` — the reference fix commit (leave unapplied)
2. Fallback: `.cursor/workspace-baseline.json` with keys `brokenSha`,
   `fixSha`, `branch`, if that file exists.

If neither resolves, stop and report; do not guess a SHA.

## Steps

1. Show what will be discarded so nothing surprising is lost:

   ```bash
   git status --short
   git log --oneline dotted-identifiers/baseline..HEAD
   ```

2. Return to the branch and reset hard to the baseline:

   ```bash
   git checkout fix/influx-dotted-identifiers
   git reset --hard dotted-identifiers/baseline
   ```

3. Remove untracked leftovers from the run, but never delete `.cursor/rules`
   or this skill (they are tracked in the baseline commit; the exclusion is
   belt-and-braces for untracked additions):

   ```bash
   git clean -fd -e .cursor
   ```

4. Confirm the fix ref is still available for the next cycle:

   ```bash
   git rev-parse dotted-identifiers/fix
   ```

5. List leftover local work and tell the user what to close out:
   - `git branch --list | grep -v -E 'main|fix/influx-dotted-identifiers'` —
     list branches created during the run; suggest deleting ones that are done.
   - `git stash list` — flag stashes that should be dropped or applied.
   - Remind the user to decline/cancel any stale Cloud Agents from the run
     and to close leftover draft PRs on the fork/remote if any were opened.

6. If the chat that invoked this skill mentioned Jira issue keys, remind the
   user to move those tickets back to Open (or reopen them) so the next cycle
   starts clean. Do not block on Jira: the git restore is complete regardless
   of whether ticket transitions succeed.

7. Print a short summary:
   - current SHA (`git rev-parse --short HEAD`) and branch
   - working tree state (`git status --short` should be empty)
   - next suggested step: start a fresh chat and pick up the open
     dotted-identifier ticket from the board.
