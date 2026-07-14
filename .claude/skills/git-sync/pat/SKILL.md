---
name: pat
description: >
  Use when asked to test the PAT (Personal Access Token) wizard flow of Git Sync
  provisioning. Runs the 5-step wizard with PAT auth, verifies the repository
  was created, and cleans up.
---

# Git Sync PAT Wizard E2E Testing

Drive the Grafana provisioning wizard through the browser using `mcp_chrome_devtools_*` tools with PAT (Personal Access Token) authentication.

## Execution Rules

**This is a test-only run.** Read `../shared/execution-rules.md` FIRST and follow all of its rules: no code changes, do not stop on failure, complete the entire flow including cleanup, budget your time, and produce the final report in the format it defines.

## Prerequisites

### Required Feature Toggles

Grafana must have these feature toggles enabled: `provisioning`, `kubernetesDashboards`, and `provisioningFolderMetadata`.

### Required Secrets

| Variable                     | Description                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| `GIT_SYNC_TEST_PAT_REPO_URL` | GitHub repo URL for PAT flow (e.g., `https://github.com/owner/repo`) |
| `GIT_SYNC_TEST_PAT`          | GitHub Personal Access Token                                         |

### Setup

Follow "Local Setup" (or "Cloud Setup" on a cloud VM) in `../shared/setup.md`. Verify each variable from the Required Secrets table above is set before proceeding.

### Cleanup Before Testing

Before running the PAT flow, delete existing test resources to avoid conflicts:

Run `bash .claude/skills/git-sync/shared/scripts/cleanup-provisioning.sh`

## Shared References

Read these files during execution for detailed operation steps, gotchas, and selectors:

- **Operations** (Steps 2-5, create/move/delete, cleanup): `../shared/operations.md`
- **Gotchas** (reconciliation delays, combobox quirks, timeouts): `../shared/gotchas.md`
- **Selectors** (element IDs, roles, placeholders): `../shared/selectors.md`
- **API reference** (cleanup & verification endpoints): `../shared/api.md`

## PAT Wizard Step 1: Connect (authType)

This is the simpler flow. Use `$GIT_SYNC_TEST_PAT_REPO_URL` and `$GIT_SYNC_TEST_PAT`.

1. `navigate_page` to `http://localhost:3000/admin/provisioning/connect/github`
2. `wait_for` text `["Connect with Personal Access Token"]`
3. `take_snapshot` to find the PAT radio button
4. `click` the radio option with label "Connect with Personal Access Token" (value: `pat`)
5. `fill` the token input (id: `token`) with `$GIT_SYNC_TEST_PAT`
6. `fill` the repository URL input (id: `repository-url`) with `$GIT_SYNC_TEST_PAT_REPO_URL`
7. `click` the Next button (text: "Configure repository")

**Wait:** The button shows "Submitting..." during K8s reconciliation. `wait_for` text `["2. Configure repository"]` (step 2 heading) with **30s timeout** before proceeding.

**Continue with Steps 2-5** from `../shared/operations.md`.

**Use path `dev/pat-test` in Step 2** to avoid conflicts with other flows (see "Path Conflicts Across Repositories" gotcha).

## Post-Wizard Verification

After Step 5 completes and the page navigates to `/admin/provisioning/{repoName}`:

1. Verify via API that the repository exists with type github and the expected URL — see "Verification Checks" in ../shared/api.md.

2. Navigate to the provisioned folder in the browse view and confirm it exists.

## Cleanup

Remove the repository and verify no artifacts remain:

Run `bash .claude/skills/git-sync/shared/scripts/cleanup-provisioning.sh`

No connection deletion needed for PAT flow -- PAT does not create connections.
