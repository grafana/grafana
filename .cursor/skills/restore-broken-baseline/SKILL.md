---
name: restore-broken-baseline
description: Restore this workspace to the known broken baseline for the dotted-identifier bug on fix/influx-dotted-identifiers, move every Task Tracking Jira issue back to To Do and every Linear "Liam — Jolly demo" issue back to Todo, remove the jira-ticket-e2e skill so it can be built live next time, and start the local Grafana server. Use after an investigation or fix cycle. Restore only — never implement or re-apply product changes.
---

# Restore workspace to the known broken baseline

This workspace tracks a known-broken state of SQL/Influx dotted-identifier
handling on the branch `fix/influx-dotted-identifiers`. After a fix cycle,
run this skill to put the working tree back to that baseline, return every
issue on the Task Tracking board to To Do, tidy leftover agent work, and
start the local Grafana server.

This skill is restore-only. Do not fix the identifier bug, do not cherry-pick
the fix commit, and do not make any other product change while running it.

After restore, remove the `jira-ticket-e2e` skill if it is present. That skill
is built live in the next session; it must not be waiting in `.cursor/skills`
when the run starts.

## Repository rules are part of the baseline (preserve them)

The workspace rules that govern how agents work — including
`.cursor/rules/testing-coverage.mdc`, `.cursor/rules/visual-verification.mdc`,
`.cursor/rules/new-eng-onboarding.mdc`, and `.github/PULL_REQUEST_TEMPLATE.md` —
are committed into the `dotted-identifiers/baseline` commit. A hard reset to that
tag therefore restores them intact; that is the mechanism, so do not try to
"protect" them with copies or stashes.

Never delete, weaken, or revert these rules while restoring. After the reset,
confirm they are present and unchanged (see step 6). If a reset ever leaves them
missing or reverted to an older/weaker version, the baseline tag is stale — stop
and report it rather than hand-editing the rules; the tag needs to be moved to a
commit that includes them.

## Baseline refs

Resolve refs in this order:

1. Git tags (preferred):
   - `dotted-identifiers/baseline` — the known broken tree (restore target)
   - `dotted-identifiers/fix` — the reference fix commit (leave unapplied)
2. Fallback: `.cursor/workspace-baseline.json` with keys `brokenSha`,
   `fixSha`, `branch`, if that file exists.

If neither resolves, stop and report; do not guess a SHA.

## Boards to reset (Jira and Linear)

The demo runs on two issue trackers: the Jira Task Tracking project and a
Linear project for customers that use Linear. Reset **both** every time,
even if the invoking chat only mentions one. Issues the invoking chat names
as preserved (e.g. curated Under Review tickets with PRs) are exceptions on
either board.

### Jira

Return **every** issue on the Task Tracking board to **To Do** (the open
column), not a hardcoded subset. Do this even if the invoking chat did not
mention any keys.

Site: `https://anysphere-team-mpn5t3b7.atlassian.net`
Cloud ID: `66ddee92-383a-4439-a196-3f7bacef6888`
Project key: `KAN`

Discover the full set with JQL (paginate until complete):

```
project = KAN ORDER BY key ASC
```

Also include any extra issue keys named in the chat that invoked this skill,
even if they are outside KAN.

The open-column transition is named **To Do** (not "Open"). Look up the
current transition id with `getTransitionsForJiraIssue` rather than hard-coding
it. Do not recreate Cursor Automations or Jira webhook rules; moving a ticket
back to To Do is enough for the next In Progress transition to fire again.

### Linear

Workspace: `linear.app/anyspherefff` · Team: `Anyspherefff` ·
Project: **Liam — Jolly demo** (ANY-18…ANY-24 mirror KAN-6…KAN-12).

Scope strictly to that project. The `Anyspherefff` team hosts unrelated
issues (other people's agent tests, prototype seeds, backlog items) — never
change anything outside the "Liam — Jolly demo" project.

Reset = set every issue in that project to **Todo** unless the invoking chat
preserves it. Use the Linear MCP: `list_issues` filtered to the project
(paginate until complete), `list_issue_statuses` for the team to resolve the
"Todo" state by name (do not hardcode state ids), and `save_issue` with the
issue id + status to apply it. Leave assignees, labels, and descriptions
untouched.

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

4. Remove the Jira ticket end-to-end skill so the next session can construct
   it live. `git clean -e .cursor` will not touch this path. Delete it even
   if it is tracked, untracked, or was recreated during the run. Do not
   recreate it, and do not copy it back from git.

   ```bash
   rm -rf .cursor/skills/jira-ticket-e2e .agents/skills/jira-ticket-e2e
   ```

   If `git status` then shows a deletion of `jira-ticket-e2e`, leave it
   deleted. Do not `git restore` that path.

5. Confirm the fix ref is still available for the next cycle, and confirm the
   workspace rules survived the reset (they live in the baseline commit):

   ```bash
   git rev-parse dotted-identifiers/fix
   git status --short .cursor/rules .github/PULL_REQUEST_TEMPLATE.md   # expect empty
   test -f .cursor/rules/testing-coverage.mdc && echo 'rules present'
   ```

   If `git status` shows those paths modified or `testing-coverage.mdc` is
   missing, the baseline tag is stale — stop and report; do not patch the rules
   by hand.

6. Move both boards back to their open column (do this; do not only remind
   the user):

   **Jira:**

   1. Search `project = KAN ORDER BY key ASC` (`searchJiraIssuesUsingJql`).
      Follow `nextPageToken` until every issue is listed.
   2. Union that set with any extra keys named in the invoking chat.
   3. For each issue: if status is already `To Do`, skip it. Otherwise list
      transitions (`getTransitionsForJiraIssue`) and apply the one whose
      target status name is `To Do` (`transitionJiraIssue`).
   4. If a ticket is Done and still has a Resolution set, clear `resolution`
      if the transition is blocked.

   **Linear:**

   5. `list_issues` for project "Liam — Jolly demo" (team `Anyspherefff`);
      paginate until complete. Do not touch issues outside that project.
   6. For each non-preserved issue not already in `Todo`: resolve the `Todo`
      state via `list_issue_statuses` and apply it with `save_issue`.

   Git restore is complete even if a board call fails. Report any Jira keys
   or Linear issue ids that could not be moved so the user can fix them by
   hand.

7. Clear leftover local work and stale pull requests (do this; do not only
   remind the user). Stale ticket-fix PRs left open across runs are confusing
   in the next demo, so close them here.

   1. Local branches: delete branches created during the run, keeping only
      `main` and `fix/influx-dotted-identifiers`:

      ```bash
      git branch --list | grep -v -E '^\*|(^|\s)(main|fix/influx-dotted-identifiers)$'
      ```

   2. Stale PRs: list open PRs and close the ones that came from this or a prior
      restore-eligible run — the per-ticket fix PRs (e.g. `agent/KAN-*`,
      `sql/*`, `cursor/*` heads for KAN-6..KAN-9) — and delete their remote
      branches:

      ```bash
      gh pr list --repo <owner>/<repo> --state open
      gh pr close <n> --repo <owner>/<repo> --delete-branch \
        --comment "Demo restore: closing stale ticket PR; ticket is back on the To Do board."
      ```

      Do **not** close PRs the user is deliberately curating. Unless the invoking
      chat says otherwise, preserve the KAN-10 and KAN-11 PRs, any already-merged
      rules/hygiene PR, and any clearly unrelated PR (e.g. provisioning). If a PR
      is ambiguous, list it and ask before closing rather than closing it.

   3. `git stash list` — flag stashes that should be dropped or applied; drop
      ones created by the run if the user confirms.

   4. Remind the user to decline/cancel any stale Cloud Agents from the run.
      The Cursor Automation and the Jira "Send web request" rule stay in place;
      do not delete them.

8. Start the local Grafana server (do this; do not only remind the user).
   Do **not** stop it as part of this skill — the user will kill it later.

   1. Health-check: `curl -fsS http://127.0.0.1:3000/api/health`
   2. If that succeeds, Grafana is already up. Report the URL and credentials;
      do not restart.
   3. Otherwise start it with the existing script (idempotent; reuses tmux
      sessions):

      ```bash
      bash .claude/skills/run-grafana/scripts/start-local.sh
      ```

   4. First backend compile can take several minutes. If the script's health
      wait times out, leave the tmux sessions running and say so. Do not
      run `stop-local.sh`.

9. Print a short summary:
   - current SHA (`git rev-parse --short HEAD`) and branch
   - working tree state (`git status --short` should be empty except an
     expected deletion of `jira-ticket-e2e` if that skill was in HEAD)
   - confirm `.cursor/skills/jira-ticket-e2e` is absent
   - confirm the workspace rules are present (`testing-coverage.mdc`,
     `visual-verification.mdc`) and any stale ticket PRs were closed
   - every Jira KAN key and every Linear "Liam — Jolly demo" issue with its
     status after the reset
   - Grafana URL `http://localhost:3000/` and login `admin` / `admin`
   - how to attach: `tmux attach -t grafana-backend` /
     `tmux attach -t grafana-frontend`
   - next suggested step: start a fresh chat and pick up a To Do ticket
     from the board (moving it to In Progress starts the Cloud Agent).
     Construct `jira-ticket-e2e` live if that workflow is needed.
