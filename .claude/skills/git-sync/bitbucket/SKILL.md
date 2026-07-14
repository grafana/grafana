---
name: bitbucket
description: >
  Use when asked to test the local Bitbucket token wizard flow of Git Sync
  provisioning. Runs the 5-step wizard with Bitbucket token auth, verifies the
  repository was created, and cleans up.
---

# Git Sync Bitbucket Wizard E2E Testing

Drive the Grafana provisioning wizard through the browser using `mcp_chrome_devtools_*` tools with Bitbucket token authentication.

## Execution Rules

**This is a test-only run.** Read `../shared/execution-rules.md` FIRST and follow all of its rules: no code changes, do not stop on failure, complete the entire flow including cleanup, budget your time, and produce the final report in the format it defines.

## Prerequisites

### Required Feature Toggles

Grafana must have these feature toggles enabled: `provisioning`, `kubernetesDashboards`, and `provisioningFolderMetadata`.

### Required Secrets

| Variable                             | Description                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `GIT_SYNC_TEST_BITBUCKET_REPO_URL`   | Bitbucket repo URL for token flow (e.g., `https://bitbucket.org/owner/repo`) |
| `GIT_SYNC_TEST_BITBUCKET_TOKEN`      | Bitbucket API Token                                                          |
| `GIT_SYNC_TEST_BITBUCKET_TOKEN_USER` | Bitbucket username used with the API token                                   |

### Setup

This skill covers the local-only Bitbucket test flow.

Follow "Local Setup" in `../shared/setup.md`. Verify each variable from the Required Secrets table above is set before proceeding.

### Cleanup Before Testing

Before running the Bitbucket flow, delete existing test resources to avoid conflicts:

Run `bash .claude/skills/git-sync/shared/scripts/cleanup-provisioning.sh`

## Shared References

Read these files during execution for detailed operation steps, gotchas, and selectors:

- **Operations** (Steps 2-5, create/move/delete, cleanup): `../shared/operations.md`
- **Gotchas** (reconciliation delays, combobox quirks, timeouts): `../shared/gotchas.md`
- **Selectors** (element IDs, roles, placeholders): `../shared/selectors.md`
- **API reference** (cleanup & verification endpoints): `../shared/api.md`

## Bitbucket Wizard Step 1: Connect (authType)

Bitbucket uses the token flow only. Use `$GIT_SYNC_TEST_BITBUCKET_REPO_URL`, `$GIT_SYNC_TEST_BITBUCKET_TOKEN`, and `$GIT_SYNC_TEST_BITBUCKET_TOKEN_USER`.

1. `navigate_page` to `http://localhost:3000/admin/provisioning/connect/bitbucket`
2. `wait_for` text `["API Token", "Username"]`
3. `take_snapshot` to confirm the token, username, and repository URL fields are visible
4. `fill` the token input (id: `token`) with `$GIT_SYNC_TEST_BITBUCKET_TOKEN`
5. `fill` the username input (id: `tokenUser`) with `$GIT_SYNC_TEST_BITBUCKET_TOKEN_USER`
6. `fill` the repository URL input (id: `repository-url`) with `$GIT_SYNC_TEST_BITBUCKET_REPO_URL`
7. `click` the Next button (text: `Configure repository`)

**Wait:** The button shows `Submitting...` during K8s reconciliation. `wait_for` text `["2. Configure repository"]` (step 2 heading) with **30s timeout** before proceeding.

**Continue with Steps 2-5** from `../shared/operations.md`.

**Use path `dev/bitbucket-test` in Step 2** to avoid conflicts with other flows (see the path-conflict gotcha).

## Post-Wizard Verification

After Step 5 completes and the page navigates to `/admin/provisioning/{repoName}`:

1. Verify via API that the repository exists with type bitbucket and the expected URL — see "Verification Checks" in ../shared/api.md.

2. Navigate to the provisioned folder in the browse view and confirm it exists.

## Cleanup

Remove the repository and verify no artifacts remain:

Run `bash .claude/skills/git-sync/shared/scripts/cleanup-provisioning.sh`

No connection deletion needed for Bitbucket token flow -- it does not create connections.

No connection deletion needed for Bitbucket token flow -- it does not create connections.
