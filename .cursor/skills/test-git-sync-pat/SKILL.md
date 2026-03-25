---
name: test-git-sync-pat
description: >
  Use when asked to test the PAT (Personal Access Token) wizard flow of Git Sync
  provisioning. Runs the 5-step wizard with PAT auth, verifies the repository
  was created, and cleans up.
---

# Git Sync PAT Wizard E2E Testing

Drive the Grafana provisioning wizard through the browser using `mcp_chrome_devtools_*` tools with PAT (Personal Access Token) authentication.

## Execution Rules

**This is a test-only run. You MUST follow these rules:**

1. **No code changes.** Do not modify any Grafana source code or test files. Configuration files (e.g., feature toggles) may be changed only as directed by the Prerequisites section. You are testing the product as-is, not fixing it.
2. **Do not stop on failure.** When a step fails, encounters a bug, or produces unexpected behavior -- document it and move on to the next step. Do not attempt to debug or fix the root cause. If a failure blocks subsequent steps, apply a minimal workaround to unblock the flow (e.g., create a resource via API if the UI failed) and note it in the report.
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

## Prerequisites

### Required Feature Toggles

Grafana must have these feature toggles enabled: `provisioning`, `kubernetesDashboards`, and `provisioningFolderMetadata`.

### Required Secrets

| Variable                     | Description                                                          |
| ---------------------------- | -------------------------------------------------------------------- |
| `GIT_SYNC_TEST_PAT_REPO_URL` | GitHub repo URL for PAT flow (e.g., `https://github.com/owner/repo`) |
| `GIT_SYNC_TEST_PAT`          | GitHub Personal Access Token                                         |

### Local Setup

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

### Cloud Setup

On a cloud VM, Grafana must be built and started from scratch.

1. **Create `conf/custom.ini`** (does not exist by default; it is gitignored):

   ```bash
   cat > conf/custom.ini << 'EOF'
   [feature_toggles]
   provisioning = true
   kubernetesDashboards = true
   provisioningFolderMetadata = true
   EOF
   ```

   Do NOT edit `conf/defaults.ini`.

2. **Start Grafana:**

   ```bash
   # Backend (first build ~3 min, hot-reload after)
   make run &
   # Frontend dev server (~45s first compile)
   yarn start &
   ```

3. **Wait for health:**

   ```bash
   for i in $(seq 1 60); do
     if curl -sf http://localhost:3000/api/health > /dev/null; then
       echo "Grafana is ready"
       break
     fi
     echo "Waiting for Grafana... ($i/60)"
     sleep 5
   done
   ```

4. **Secrets** are available as environment variables (configured in Cursor dashboard). Do not use `.env` files. Verify:

   ```bash
   for var in GIT_SYNC_TEST_PAT_REPO_URL GIT_SYNC_TEST_PAT; do
     if [ -z "${!var}" ]; then echo "ERROR: $var is not set"; exit 1; fi
     echo "OK: $var is set"
   done
   ```

5. **Log in to Grafana:** Open browser to `http://localhost:3000`. Log in as `admin`/`admin`. Skip password change if prompted.

### Cleanup Before Testing

Before running the PAT flow, delete existing test resources to avoid conflicts:

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

**Continue with Steps 2-5** from `../git-sync-shared/operations.md`.

**Use path `dev/pat-test` in Step 2** to avoid conflicts with other flows (see "Path Conflicts Across Repositories" gotcha).

## Post-Wizard Verification

After Step 5 completes and the page navigates to `/admin/provisioning/{repoName}`:

1. Verify the repository was created via API:

   ```bash
   curl -s -u admin:admin \
     http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
     jq '.items[] | {name: .metadata.name, type: .spec.type, url: .spec.github.url}'
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

No connection deletion needed for PAT flow -- PAT does not create connections.
