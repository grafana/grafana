---
name: test-git-sync-github-app
description: >
  Use when asked to test the GitHub App wizard flow of Git Sync provisioning.
  Runs the 5-step wizard with GitHub App auth (connection creation, PEM
  injection), verifies the repository was created, and cleans up the repository
  and connection.
---

# Git Sync GitHub App Wizard E2E Testing

Drive the Grafana provisioning wizard through the browser using `mcp_chrome_devtools_*` tools with GitHub App authentication.

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

| Variable                                    | Description                          |
| ------------------------------------------- | ------------------------------------ |
| `GIT_SYNC_TEST_APP_REPO_URL`                | GitHub repo URL for GitHub App flow  |
| `GIT_SYNC_TEST_GITHUB_APP_ID`               | GitHub App ID, numeric               |
| `GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`  | GitHub App Installation ID, numeric  |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` | Path to PEM private key file (local) |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY`      | PEM private key content (cloud)      |

Locally, `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` points to the PEM file. On cloud, `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY` contains the PEM content directly.

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
   for var in GIT_SYNC_TEST_APP_REPO_URL GIT_SYNC_TEST_GITHUB_APP_ID \
              GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID \
              GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY; do
     if [ -z "${!var}" ]; then echo "ERROR: $var is not set"; exit 1; fi
     echo "OK: $var is set"
   done
   ```

5. **Log in to Grafana:** Open browser to `http://localhost:3000`. Log in as `admin`/`admin`. Skip password change if prompted.

### Cleanup Before Testing

Before running the GitHub App flow, delete existing test resources to avoid conflicts:

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

## GitHub App Wizard Step 1: Connect (authType)

Requires `$GIT_SYNC_TEST_APP_REPO_URL`, `$GIT_SYNC_TEST_GITHUB_APP_ID`, `$GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`, and the PEM private key (via `$GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` locally or `$GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY` on cloud).

1. `navigate_page` to `http://localhost:3000/admin/provisioning/connect/github`
2. `wait_for` text `["Connect with GitHub App"]`
3. "Connect with GitHub App" is selected by default (value: `github-app`)

**Creating a new connection:**

4. If no connections exist, mode auto-selects "Connect to a new app". Otherwise, `click` the "Connect to a new app" radio option.
5. `fill` the title input (id: `title`, placeholder: `My GitHub App`) -- pick any descriptive name
6. `fill` the App ID input (id: `appID`, placeholder: `123456`) with `$GIT_SYNC_TEST_GITHUB_APP_ID`
7. `fill` the Installation ID input (id: `installationID`, placeholder: `12345678`) with `$GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`
8. The private key textarea (id: `privateKey`) **does not accept multiline content via `fill`**. Instead, get the PEM content (from `$GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` file locally, or `$GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY` env var on cloud) and inject it via `evaluate_script`:
   ```js
   (pemContent) => {
     const ta = document.querySelector('textarea');
     const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
     setter.call(ta, pemContent);
     ta.dispatchEvent(new Event('input', { bubbles: true }));
     ta.dispatchEvent(new Event('change', { bubbles: true }));
   };
   ```
   Pass the PEM string as an argument.
9. `click` "Create connection"
10. **Wait:** The connection status shows "Pending" after creation. **Known bug: the UI does not auto-update the connection status** (no WebSocket push, no polling). The connection becomes ready within ~10s on the backend. **Workaround:** `navigate_page` to reload the wizard page, then switch to "Choose an existing app" and select the connection from the dropdown. It will show "Connected".

**Using an existing connection:**

4. `click` the "Choose an existing app" radio option
5. `click` the connection combobox (placeholder: `Select a GitHub App connection`)
6. **Combobox options may not appear in `take_snapshot`** a11y output. Use `evaluate_script` to inspect the DOM:
   ```js
   () => {
     const options = document.querySelectorAll('[role="option"]');
     return Array.from(options).map((o) => ({ id: o.id, text: o.textContent.trim() }));
   };
   ```
   Then click the target option by DOM id via `evaluate_script`:
   ```js
   () => document.getElementById('combobox-option-<id>').click();
   ```

**After connection is selected/created:**

11. The repository URL field becomes a combobox populated from the connection's repos.
12. `take_snapshot` to find the repo combobox. `click` it, then `type_text` to filter for the repo matching `$GIT_SYNC_TEST_APP_REPO_URL`. **Options may not appear in the a11y snapshot** -- use `evaluate_script` to inspect and click the correct `[role="option"]` by DOM id (same technique as step 6 above).
13. `click` "Configure repository"

**Wait:** Same as PAT flow -- `wait_for` step 2 heading with **30s timeout**.

**Continue with Steps 2-5** from `../git-sync-shared/operations.md`. Steps 2-5 are identical to the PAT flow.

**Use path `dev/app-test` in Step 2** to avoid conflicts with other flows (see "Path Conflicts Across Repositories" gotcha).

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

Remove the repository and connection, then verify no artifacts remain:

```bash
BASE="http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default"
AUTH="admin:admin"

# Delete repositories first (must be deleted before their connections)
for name in $(curl -s -u "$AUTH" "$BASE/repositories" | jq -r '.items[].metadata.name'); do
  echo "Deleting repository: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/repositories/$name"
done

# Then delete connections (GitHub App flow creates connections)
for name in $(curl -s -u "$AUTH" "$BASE/connections" | jq -r '.items[].metadata.name // empty'); do
  echo "Deleting connection: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/connections/$name"
done

echo "Cleanup complete."
```

Verify:

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
  jq '.items | length'
# Should return 0

curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/connections | \
  jq '.items | length'
# Should return 0
```
