---
name: restore-broken-baseline
description: Restore this workspace to the known broken baseline for the dotted-identifier bug on fix/influx-dotted-identifiers, and move the related Jira tickets back to To Do. Use after an investigation or fix cycle. Restore only — never implement or re-apply product changes.
---

# Restore workspace to the known broken baseline

This workspace tracks a known-broken state of SQL/Influx dotted-identifier
handling on the branch `fix/influx-dotted-identifiers`. After a fix cycle,
run this skill to put the working tree back to that baseline, return the
board tickets to To Do, and tidy leftover agent work.

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

## Jira board to reset

Always return these Task Tracking issues to **To Do** (the open column),
even if the invoking chat did not mention them:

- KAN-6
- KAN-7
- KAN-8
- KAN-9

Also include any extra issue keys named in the chat that invoked this skill.

Site: `https://anysphere-team-mpn5t3b7.atlassian.net`
Cloud ID: `66ddee92-383a-4439-a196-3f7bacef6888`
Project key: `KAN`

The open-column transition is named **To Do** (not "Open"). Look up the
current transition id with `getTransitionsForJiraIssue` rather than hard-coding
it. Do not recreate Cursor Automations or Jira webhook rules; moving a ticket
back to To Do is enough for the next In Progress transition to fire again.

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

5. Move Jira tickets back to To Do (do this; do not only remind the user):

   For each key in the list above:

   1. Read the issue (`getJiraIssue`).
   2. If status is already `To Do`, skip it.
   3. Otherwise list transitions (`getTransitionsForJiraIssue`) and apply the
      one whose target status name is `To Do` (`transitionJiraIssue`).
   4. If a ticket is Done and still has a Resolution set, clear `resolution`
      if the transition is blocked.

   Git restore is complete even if a Jira call fails. Report any keys that
   could not be moved so the user can fix them by hand.

6. List leftover local work and tell the user what to close out:
   - `git branch --list | grep -v -E 'main|fix/influx-dotted-identifiers'` —
     list branches created during the run; suggest deleting ones that are done.
   - `git stash list` — flag stashes that should be dropped or applied.
   - Remind the user to decline/cancel any stale Cloud Agents from the run
     and to close leftover draft PRs on the fork/remote if any were opened.
   - The Cursor Automation and the Jira "Send web request" rule stay in place;
     do not delete them.

7. Print a short summary:
   - current SHA (`git rev-parse --short HEAD`) and branch
   - working tree state (`git status --short` should be empty)
   - each Jira key and its status after the reset
   - next suggested step: start a fresh chat and pick up a To Do ticket
     from the board (moving it to In Progress starts the Cloud Agent).
