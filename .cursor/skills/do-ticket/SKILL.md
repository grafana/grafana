---
name: do-ticket
description: Implement a Jira ticket end-to-end. Reads the ticket, explores the codebase, creates an implementation plan in Notion, checks out a feature branch, implements changes, organizes commits, and opens a GitHub PR. Use when the user provides a Jira ticket ID (e.g., GRAF-123) and wants it implemented.
---

# Do Ticket

Implement a Jira ticket from start to finish: read → plan → clarify → publish → branch → implement → commit → PR.

## Workflow

### Phase 1: Understand

1. **Read the Jira ticket**

   Use both tools from the `user-jira` MCP to get full context:
   ```
   server: user-jira
   tool: getJiraIssue
   args: { "issueKey": "GRAF-123" }
   ```
   ```
   server: user-jira
   tool: analyzeJiraIssue
   args: { "issueKey": "GRAF-123" }
   ```

   Extract: summary, description, acceptance criteria, linked issues.

2. **Check for Figma designs** (conditional)

   Scan the ticket description and attachments for Figma URLs matching
   `figma.com/design/` or `figma.com/make/`.

   If found, extract `fileKey` and `nodeId` from the URL and fetch the design:
   ```
   server: plugin-figma-figma
   tool: get_design_context
   args: { "fileKey": "<fileKey>", "nodeId": "<nodeId>" }
   ```
   ```
   server: plugin-figma-figma
   tool: get_screenshot
   args: { "fileKey": "<fileKey>", "nodeId": "<nodeId>" }
   ```

   This returns reference code, a screenshot, and contextual hints.
   - Use the screenshot as the visual spec during implementation
   - Adapt the reference code to the project's stack and conventions
   - Do NOT copy the reference code verbatim — it is a starting point

   If no Figma URL is found, skip this step entirely.

3. **Explore the codebase**

   Launch an `explore` subagent to understand:
   - Relevant files and modules
   - Existing patterns to follow
   - Dependencies and interfaces
   - Test coverage expectations

4. **Ask clarifying questions**

   Use `AskQuestion` tool to resolve ambiguities:
   - Scope boundaries
   - Technical approach preferences
   - Priority of acceptance criteria
   - Known constraints or blockers

### Phase 2: Plan

5. **Create implementation plan**

   Structure the plan:
   ```markdown
   # Implementation Plan: [TICKET-ID] [Summary]

   ## Scope
   [What's in/out of scope]

   ## Design Reference
   [If Figma URL was found in step 2, include the link and a summary of the
   design intent. Otherwise omit this section.]

   ## Approach
   [Technical approach and rationale]

   ## File Changes
   - `path/to/file.ts` - [what changes]
   - `path/to/test.ts` - [test additions]

   ## Steps
   1. [First implementation step]
   2. [Second step]
   ...

   ## Edge Cases
   - [Edge case 1]
   - [Edge case 2]

   ## Test Plan
   - [ ] Unit tests for X
   - [ ] Integration test for Y

   ## Risks
   - [Risk and mitigation]
   ```

6. **Publish plan to Notion**

   Use `notion-create-pages` from the `user-Notion` MCP:
   ```
   server: user-Notion
   tool: notion-create-pages
   args: {
     "pages": [{
       "properties": { "title": "[TICKET-ID] Implementation Plan" },
       "content": "<plan content in Notion Markdown>"
     }]
   }
   ```

   To publish under an existing parent page, add `"parent": { "page_id": "<id>" }`.

   Output the Notion page URL to the user.

### Phase 3: Implement

7. **Check out feature branch**

   Branch name format: `av-<ticket-id>-<short-description>` (lowercase).

   ```bash
   git checkout -b av-graf-123-short-description
   ```

8. **Implement the changes**

   Follow the plan step by step:
   - Make changes incrementally
   - Run linting after edits (`ReadLints`)
   - Run relevant tests as you go
   - Stage logically related changes together
   - When building UI components, reference the Figma screenshot from step 2
     to validate visual fidelity (if one was fetched)

9. **Organize commits**

   Group related changes into logical commits:
   - Use `<Area>: <Summary>` format for messages
   - One conceptual change per commit
   - Single-line commit messages
   - Each commit should leave the codebase buildable

### Phase 4: Ship

10. **Push and create PR**

   ```bash
   git push -u origin HEAD
   ```

   Create the PR using `gh`:
   ```bash
   gh pr create \
     --title "[TICKET-ID] <Summary>" \
     --body "<PR description>"
   ```

11. **Output links**

    Provide the user with:
    - GitHub PR URL
    - Notion plan URL
    - Figma design URL (if applicable)
    - Summary of changes made

## PR Description Template

```markdown
## Summary
[Brief description of what this PR does]

## Jira Ticket
[TICKET-ID](https://grafana.atlassian.net/browse/TICKET-ID)

## Implementation Plan
[Link to Notion page]

## Design
[Figma link, if applicable]

## Changes
- [Change 1]
- [Change 2]

## Test Plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual verification
```

## Error Handling

- **Jira unavailable**: Inform user, ask for ticket details manually
- **Notion publish fails**: Save plan locally as `plan-TICKET-ID.md`, retry, or ask user
- **Branch exists**: Ask user whether to use existing or create new
- **Push fails**: Check for conflicts, rebase if needed
- **PR creation fails**: Provide manual steps to create PR

## Checklist

Before completing:

- [ ] Jira ticket read and understood
- [ ] Figma designs fetched (if linked in ticket)
- [ ] Clarifying questions resolved
- [ ] Implementation plan published to Notion
- [ ] Feature branch created with `av-` prefix
- [ ] All changes implemented per plan
- [ ] Commits organized logically
- [ ] Branch pushed to origin
- [ ] PR created with proper description
- [ ] PR and Notion plan links provided to user
