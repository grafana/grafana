---
name: test-git-sync-gitlab
description: >
  Use when asked to test the local GitLab token wizard flow of Git Sync
  provisioning. Runs the 5-step wizard with GitLab token auth, verifies the
  repository was created, and cleans up.
---

# Git Sync GitLab Wizard E2E Testing

Drive the Grafana provisioning wizard through the browser using `mcp_chrome_devtools_*` tools with GitLab token authentication.

## Execution Rules

**This is a test-only run. You MUST follow these rules:**

1. **No code changes.** Do not modify any Grafana source code or test files. Configuration files (e.g., feature toggles) may be changed only as directed by the Prerequisites section. You are testing the product as-is, not fixing it.
2. **Do not stop on failure.** When a step fails, encounters a bug, or produces unexpected behavior -- document it and move on to the next step. Do not attempt to debug or fix the root cause. If a failure blocks subsequent steps, apply a minimal workaround to unblock the flow and note it in the report. **Workaround must use the same mechanism as the original step** (e.g., retry with slightly different input, skip to a later step that creates the needed state). Do not switch to a different API or creation method -- the resource may not behave the same way in subsequent steps.
3. **Complete the entire flow.** Execute every step from start to finish, including cleanup. Skipping steps after a failure loses coverage.
4. **Produce a final report.** After completing all steps (or reaching the end), output a structured report:

   ### Report Format

   ```
   ## Test Run Report

   **Skill:** <skill name>
   **Date:** <date>
   **Status:** PASS | PARTIAL | FAIL

   ### Steps Completed
   - Step N: <description> -- PASS | FAIL
     - [if FAIL] **Issue:** <what happened, expected vs actual>

   ### Summary
   - Total steps: N
   - Passed: N
   - Failed: N
   - Blocked (could not attempt due to prior failure state): N

   ### Issues Found
   1. **[Step N] <title>**: <description of the bug or unexpected behavior>
   ```

5. **Budget your time.** Allocate effort across all phases, not just the first. If a phase is consuming disproportionate time due to repeated failures or workarounds, document what you've observed and advance to the next phase. Partial coverage of every phase is more valuable than exhaustive coverage of one.

## Prerequisites

### Required Feature Toggles

Grafana must have these feature toggles enabled: `provisioning`, `kubernetesDashboards`, and `provisioningFolderMetadata`.

### Required Secrets

| Variable                        | Description                                                            |
| ------------------------------- | ---------------------------------------------------------------------- |
| `GIT_SYNC_TEST_GITLAB_REPO_URL` | GitLab repo URL for token flow (e.g., `https://gitlab.com/owner/repo`) |
| `GIT_SYNC_TEST_GITLAB_TOKEN`    | GitLab Project Access Token                                            |

### Local Setup

This skill covers the local-only GitLab test flow.

1. Create `.env` in the project root with credentials (see `.env.example`). Ensure `.env` is in `.gitignore`.
2. Source the credentials:
   ```bash
   source .cursor/skills/git-sync-shared/scripts/load-env.sh
   ```
3. Add the feature toggles to `conf/custom.ini`:
   ```ini
   [feature_toggles]
   provisioning = true
   kubernetesDashboards = true
   provisioningFolderMetadata = true
   ```
4. Grafana must be running at `http://localhost:3000`.

### Cleanup Before Testing

Before running the GitLab flow, delete existing test resources to avoid conflicts:

```bash
BASE="http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default"
AUTH="admin:admin"

# Delete repositories first (must be deleted before their connections)
for name in $(curl -s -u "$AUTH" "$BASE/repositories" | jq -r '.items[].metadata.name'); do
  echo "Deleting repository: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/repositories/$name"
done

# Then delete connections
for name in $(curl -s -u "$AUTH" "$BASE/connections" | jq -r '.items[].metadata.name // empty'); do
  echo "Deleting connection: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/connections/$name"
done

echo "Cleanup complete."
```

## Shared References

Read these files during execution for detailed operation steps, gotchas, and selectors:

- **Operations** (Steps 2-5, create/move/delete, cleanup): `../git-sync-shared/operations.md`
- **Gotchas** (reconciliation delays, combobox quirks, timeouts): `../git-sync-shared/gotchas.md`
- **Selectors** (element IDs, roles, placeholders): `../git-sync-shared/selectors.md`
- **API reference** (cleanup & verification endpoints): `../git-sync-shared/api.md`

## GitLab Wizard Step 1: Connect (authType)

GitLab uses the token flow only. Use `$GIT_SYNC_TEST_GITLAB_REPO_URL` and `$GIT_SYNC_TEST_GITLAB_TOKEN`.

1. `navigate_page` to `http://localhost:3000/admin/provisioning/connect/gitlab`
2. `wait_for` text `["Project Access Token"]`
3. `take_snapshot` to confirm the token and repository URL fields are visible
4. `fill` the token input (id: `token`) with `$GIT_SYNC_TEST_GITLAB_TOKEN`
5. `fill` the repository URL input (id: `repository-url`) with `$GIT_SYNC_TEST_GITLAB_REPO_URL`
6. `click` the Next button (text: `Configure repository`)

**Wait:** The button shows `Submitting...` during K8s reconciliation. `wait_for` text `["2. Configure repository"]` (step 2 heading) with **30s timeout** before proceeding.

**Continue with Steps 2-5** from `../git-sync-shared/operations.md`.

**Use path `dev/gitlab-test` in Step 2** to avoid conflicts with other flows (see the path-conflict gotcha).

**GitLab-specific Step 5 note:** The branch workflow checkbox label is `Enable merge request option when saving`.

## Post-Wizard Verification

After Step 5 completes and the page navigates to `/admin/provisioning/{repoName}`:

1. Verify the repository was created via API:

   ```bash
   curl -s -u admin:admin \
     http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
     jq '.items[] | {name: .metadata.name, type: .spec.type, url: .spec.gitlab.url}'
   ```

2. Navigate to the provisioned folder in the browse view and confirm it exists.

## Cleanup

Remove the repository and verify no artifacts remain:

```bash
BASE="http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default"
AUTH="admin:admin"

# Delete repositories
for name in $(curl -s -u "$AUTH" "$BASE/repositories" | jq -r '.items[].metadata.name'); do
  echo "Deleting repository: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/repositories/$name"
done

echo "Cleanup complete."
```

Verify:

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
  jq '.items | length'
# Should return 0
```

No connection deletion needed for GitLab token flow -- it does not create connections.
