---
name: jira-ticket-e2e
description: >-
  Pull Jira tickets from Task Tracking via Atlassian MCP and execute a ticket
  end-to-end when the user supplies an issue key (e.g. KAN-6). Use when the
  user asks to pull/fetch Jira tickets, work a ticket, implement KAN-N,
  or run a ticket through plan → fix → test → commit.
disable-model-invocation: true
---

# Jira ticket pull and end-to-end execution

Fetch issues from the Task Tracking board and, when the user names a ticket
key, drive it through research → plan → implement → verify → commit.

## Jira site (this repo)

| Field | Value |
|-------|-------|
| Site | `https://anysphere-team-mpn5t3b7.atlassian.net` |
| Cloud ID | `66ddee92-383a-4439-a196-3f7bacef6888` |
| Project | `KAN` (Task Tracking) |

Use the **Atlassian MCP** server (`plugin-atlassian-atlassian`). Call
`GetMcpTools` before the first MCP call if schemas are unknown.

## Mode A — Pull my tickets (no key required)

When the user asks to pull/list/fetch their Jira tickets without naming one
key:

1. `atlassianUserInfo` — confirm auth; note display name / account id.
2. `getAccessibleAtlassianResources` — confirm cloud id above.
3. `searchJiraIssuesUsingJql` with:
   ```text
   assignee = currentUser() AND resolution = Unresolved ORDER BY priority DESC, updated DESC
   ```
   Request fields: `summary`, `status`, `issuetype`, `priority`, `project`,
   `updated`, `labels`, `description`. Paginate with `nextPageToken` until
   `isLast`.
4. Present a compact table: key (linked to browse URL), summary, status,
   priority, labels, updated.
5. Group or call out themes if obvious (e.g. several `@grafana/sql` tickets).
6. Do **not** start implementation unless the user picks a ticket next.

Browse URL pattern:
`https://anysphere-team-mpn5t3b7.atlassian.net/browse/{KEY}`

## Mode B — Execute one ticket (user supplies key)

Trigger when the user names an issue key (`KAN-6`, `KAN-6: title`, "work
KAN-6 end to end", "implement KAN-6", etc.). Extract the key with pattern
`/[A-Z]+-\d+/`.

### 1. Fetch the ticket

```text
getJiraIssue(
  cloudId: "66ddee92-383a-4439-a196-3f7bacef6888",
  issueIdOrKey: "{KEY}",
  fields: ["summary", "description", "status", "issuetype", "priority",
           "labels", "assignee", "reporter", "created", "updated", "comment"]
)
```

If the call fails with auth, run `mcp_auth` for the Atlassian server and
retry once.

### 2. Parse the description

Read the ticket body and extract:

| Section | Use for |
|---------|---------|
| **Context** | Root cause, upstream links, related tickets |
| **Acceptance criteria** | Definition of done; test ideas |
| **File hints** / **In this codebase** | Starting paths |
| **Repro** | Manual verification steps |
| **Expected vs actual** | Assertion targets for tests |

Call out identifier/SQL quirks (dotted names, quoting) when the ticket
touches InfluxQL/SQL builders — see `.cursor/rules/sql-influx-identifiers.mdc`.

### 3. Brief the user

Before coding, state:

- Key, summary, status, priority
- Acceptance criteria (bulleted)
- Files you expect to touch and why
- Scope boundaries (what this ticket is **not**)
- Whether visual verification is feasible in this tree

### 4. Research the codebase

- Read file hints and callers before editing.
- Stay in this Grafana tree (`packages/grafana-sql`, SQL Expressions, and other
  in-repo paths). Do not treat a missing plugin folder as a blocker.
- Prefer the smallest change that meets acceptance criteria.
- Do not refactor unrelated modules in the same pass.
- Read subtree `AGENTS.md` when working under documented paths
  (`docs/`, alerting, `pkg/storage/unified/`, etc.).

### 5. Plan vs implement

| User intent | Action |
|-------------|--------|
| "plan", "create a plan", Plan mode | Produce a concise plan; **do not** edit code |
| "implement", "fix", "execute", or no plan requested after plan approved | Implement |

If the user attached a plan file, follow it. **Do not edit the plan file.**

When planning, ask 1–2 scope questions only when multiple valid approaches
would change the diff significantly (e.g. qualified-name semantics).

### 6. Implement

- Touch only files required by the ticket.
- Add or update tests for changed behavior.
- Match surrounding code style; comments only for non-obvious traps.
- If a change alters query semantics, say so explicitly before applying.

### 7. Verify

Run targeted tests first, then broader suites only if cheap:

```bash
./node_modules/.bin/jest --no-watch <path-to-test-file>
./node_modules/.bin/jest --no-watch <package-or-feature-dir>
```

For user-visible fixes (panels, Explore, generated SQL in UI), note visual
verification steps per `.cursor/rules/visual-verification.mdc`. If the
affected UI is not runnable in this checkout, say so in the PR/summary and
rely on unit tests.

### 8. Commit, push, and open a PR

Do not leave ticket work on a local branch. After the change (code, tests,
or a findings note):

1. Commit on a unique feature branch (not `main`, not
   `fix/influx-dotted-identifiers`). Stage **only** ticket-related files.
2. Push the branch.
3. Open a GitHub pull request against `main` with `gh pr create` (draft is
   acceptable; open is preferred). Do not wait for the user to click around
   the GitHub UI. Do not merge unless asked.

Commit message format:

```text
fix(scope): short imperative summary

One sentence on why. Reference KAN-N in body or footer.
```

If this Grafana tree cannot implement the ticket, open a findings PR here
rather than stopping at a chat note. Do not switch to another repository
unless the user explicitly asks.

The restore-broken-baseline skill is the exception: it must not open a PR.

### 9. Optional — transition ticket status

Only when the user asks to update Jira status:

1. `getTransitionsForJiraIssue` for the key.
2. `transitionJiraIssue` to the named target (e.g. **In Progress** when
   starting work, **Done** when merged — match team convention).
3. If Done is blocked by Resolution, clear with `editJiraIssue`
   `{ "resolution": null }` first.

Do not transition tickets automatically unless requested.

## End-to-end checklist

Copy and track when executing Mode B:

```text
- [ ] Fetch ticket (getJiraIssue)
- [ ] Parse acceptance criteria and file hints
- [ ] Brief user on scope
- [ ] Research callers and existing tests
- [ ] Plan (if requested) or implement
- [ ] Add/update tests
- [ ] Run targeted jest
- [ ] Summarize semantics impact (if any)
- [ ] Commit, push, and open a PR (draft is enough)
```

## Example invocations

**List tickets:**
> Pull in my Jira tickets

**Plan one ticket:**
> Create a plan to tackle KAN-6

**Full execution:**
> KAN-6 — implement the plan and commit

**Fetch + start:**
> Work KAN-8 end to end

## Related skills

- `restore-broken-baseline` — reset workspace and move KAN board back to To Do
  after a fix cycle (restore only; never re-apply fixes).
- `run-grafana` — local dev instance for manual/visual verification when the
  UI path is runnable in this tree.
