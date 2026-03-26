---
name: test-git-sync-resource-ops
description: >
  Use when asked to test provisioned resource operations with multiple user
  roles (Admin, Editor, Viewer). Creates a repository via API, then exercises
  folder/dashboard CRUD, bulk move, bulk delete, and permission restrictions
  across all three roles.
---

# Git Sync Resource Operations & Permissions Testing

Tests provisioned resource operations across Admin, Editor, and Viewer roles. Sets up a repository via API (no wizard), creates test users, and exercises CRUD, bulk operations, and permission restrictions.

## Execution Rules

**This is a test-only run. You MUST follow these rules:**

1. **No code changes.** Do not modify any Grafana source code or test files. Configuration files (e.g., feature toggles) may be changed only as directed by the Prerequisites section. You are testing the product as-is, not fixing it.
2. **Do not stop on failure.** When a step fails, encounters a bug, or produces unexpected behavior -- document it and move on to the next step. Do not attempt to debug or fix the root cause. If a failure blocks subsequent steps, apply a minimal workaround to unblock the flow and note it in the report. **Workaround must use the same mechanism as the original step** (e.g., retry with slightly different input, skip to a later step that creates the needed state). Do not switch to a different API or creation method -- the resource may not behave the same way in subsequent steps.
3. **Handle transient connection-loss alerts carefully.** Local/dev runs may occasionally show `Connection to server is lost...` during a save or drawer submit even when Grafana recovers on its own. Record the alert, wait for the page to recover or retry the same UI action once, and only treat it as a product failure if it persists or blocks progress while `/api/health` is still OK.
4. **Complete the entire flow.** Execute every step from start to finish, including cleanup. Skipping steps after a failure loses coverage.
5. **Produce a final report.** After completing all steps (or reaching the end), output a structured report:

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

6. **Budget your time.** Allocate effort across all phases, not just the first. If a phase is consuming disproportionate time due to repeated failures or workarounds, document what you've observed and advance to the next phase. Partial coverage of every phase is more valuable than exhaustive coverage of one.

## Prerequisites

### Required Feature Toggles

Grafana must have these feature toggles enabled: `provisioning`, `kubernetesDashboards`, and `provisioningFolderMetadata`.

### Required Secrets

| Variable                     | Description                                             |
| ---------------------------- | ------------------------------------------------------- |
| `GIT_SYNC_TEST_PAT_REPO_URL` | GitHub repo URL (e.g., `https://github.com/owner/repo`) |
| `GIT_SYNC_TEST_PAT`          | GitHub Personal Access Token                            |

Only PAT credentials are needed -- the simplest auth type for API-based setup.

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

Before running, delete existing test resources and users to avoid conflicts:

```bash
BASE="http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default"
AUTH="admin:admin"

# Delete repositories
for name in $(curl -s -u "$AUTH" "$BASE/repositories" | jq -r '.items[].metadata.name'); do
  echo "Deleting repository: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/repositories/$name"
done

# Delete connections
for name in $(curl -s -u "$AUTH" "$BASE/connections" | jq -r '.items[].metadata.name // empty'); do
  echo "Deleting connection: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/connections/$name"
done

# Delete test users (ignore 404 if they don't exist)
for login in viewer-test editor-test; do
  USER_ID=$(curl -s -u "$AUTH" "http://localhost:3000/api/users/lookup?loginOrEmail=$login" | jq -r '.id // empty')
  if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
    curl -s -X DELETE -u "$AUTH" "http://localhost:3000/api/admin/users/$USER_ID"
    echo "Deleted user: $login (id: $USER_ID)"
  fi
done

echo "Cleanup complete."
```

## Shared References

Read these files during execution for detailed operation steps, gotchas, and selectors:

- **Operations** (create/move/delete resources, user management, API setup): `../git-sync-shared/operations.md`
- **Gotchas** (reconciliation delays, combobox quirks, timeouts): `../git-sync-shared/gotchas.md`
- **Selectors** (element IDs, roles, placeholders, login page): `../git-sync-shared/selectors.md`
- **API reference** (repository CRUD, jobs, user management): `../git-sync-shared/api.md`

## RBAC Permission Matrix

| Capability                             | Viewer | Editor | Admin |
| -------------------------------------- | ------ | ------ | ----- |
| Browse provisioned folders/dashboards  | Yes    | Yes    | Yes   |
| View dashboard content                 | Yes    | Yes    | Yes   |
| Create folders/dashboards (push jobs)  | No     | Yes    | Yes   |
| Modify/save dashboards (push jobs)     | No     | Yes    | Yes   |
| Delete resources (delete jobs)         | No     | Yes    | Yes   |
| Move resources (move jobs)             | No     | Yes    | Yes   |
| Access /admin/provisioning/\* pages    | No     | No     | Yes   |
| Repository CRUD (create/update/delete) | No     | No     | Yes   |
| Connection management                  | No     | No     | Yes   |
| Trigger sync (pull jobs)               | No     | No     | Yes   |

---

## Phase A: Admin Setup (Steps 1-4)

### Step 1: Create Test Users

Create `viewer-test` and `editor-test` users via API. See "Create Test Users via API" in `../git-sync-shared/operations.md`.

**Create Viewer user:**

```bash
VIEWER_ID=$(curl -s -X POST -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/admin/users \
  -d '{"login":"viewer-test","password":"viewer-test","email":"viewer@test.com","name":"Viewer Test"}' | jq -r '.id')

curl -s -X PATCH -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/org/users/$VIEWER_ID \
  -d '{"role":"Viewer"}'
echo "Created viewer-test with ID: $VIEWER_ID"
```

**Create Editor user:**

```bash
EDITOR_ID=$(curl -s -X POST -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/admin/users \
  -d '{"login":"editor-test","password":"editor-test","email":"editor@test.com","name":"Editor Test"}' | jq -r '.id')

curl -s -X PATCH -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/org/users/$EDITOR_ID \
  -d '{"role":"Editor"}'
echo "Created editor-test with ID: $EDITOR_ID"
```

**Store both user IDs** -- they are needed for cleanup in Step 17.

### Step 2: Create Repository via API

Create a PAT repository without the wizard. See "API Repository Setup" in `../git-sync-shared/operations.md`.

```bash
curl -s -X POST -u admin:admin \
  -H 'Content-Type: application/json' \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories \
  -d '{
  "apiVersion": "provisioning.grafana.app/v0alpha1",
  "kind": "Repository",
  "metadata": {
    "name": "ops-test-repo"
  },
  "spec": {
    "title": "Ops Test Repository",
    "description": "API-created repo for resource operation testing",
    "type": "github",
    "github": {
      "url": "'"$GIT_SYNC_TEST_PAT_REPO_URL"'",
      "branch": "agent-test",
      "generateDashboardPreviews": false,
      "path": "dev/ops-test"
    },
    "sync": {
      "enabled": true,
      "target": "folder",
      "intervalSeconds": 60
    },
    "workflows": ["write", "branch"]
  },
  "secure": {
    "token": { "create": "'"$GIT_SYNC_TEST_PAT"'" }
  }
}'
```

**Trigger initial sync and wait:**

```bash
JOB_NAME=$(curl -s -X POST -u admin:admin \
  -H 'Content-Type: application/json' \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/ops-test-repo/jobs \
  -d '{"action":"pull","pull":{}}' | jq -r '.metadata.name')

for i in $(seq 1 30); do
  STATE=$(curl -s -u admin:admin \
    "http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/ops-test-repo/jobs/$JOB_NAME" | \
    jq -r '.status.state')
  echo "Job state: $STATE ($i/30)"
  if [ "$STATE" = "success" ]; then break; fi
  if [ "$STATE" = "error" ]; then echo "ERROR: Sync failed"; break; fi
  sleep 5
done
```

### Step 3: Create Resources (3-Level Tree) -- Write Workflow

Logged in as **admin**. Build the following folder/dashboard tree inside the provisioned root using the **configured branch** (`agent-test`). Use "Creating a New Folder" and "Creating a New Dashboard" from `../git-sync-shared/operations.md` for each resource.

```
<provisioned root>/
├─ team-alpha/                        (folder, level 1)
│  ├─ Dashboard Alpha-1                (dashboard)
│  ├─ Dashboard Alpha-2                (dashboard)
│  └─ alpha-services/                  (folder, level 2)
│     ├─ Dashboard Alpha-Svc-1          (dashboard)
│     └─ alpha-monitoring/               (folder, level 3)
│        └─ Dashboard Alpha-Mon-1        (dashboard)
├─ team-beta/                         (folder, level 1)
│  ├─ Dashboard Beta-1                 (dashboard)
│  └─ Dashboard Beta-2                 (dashboard)
└─ staging/                           (folder, level 1)
   └─ Dashboard Staging-1              (dashboard)
```

**Creation order** (12 resources: 6 folders counting provisioned root's children, 6 dashboards):

1. Create folder `team-alpha` in provisioned root
2. Create `Dashboard Alpha-1` in `team-alpha`
3. Create `Dashboard Alpha-2` in `team-alpha`
4. Create folder `alpha-services` inside `team-alpha`
5. Create `Dashboard Alpha-Svc-1` in `alpha-services`
6. Create folder `alpha-monitoring` inside `alpha-services` (level 3)
7. Create `Dashboard Alpha-Mon-1` in `alpha-monitoring`
8. Create folder `team-beta` in provisioned root
9. Create `Dashboard Beta-1` in `team-beta`
10. Create `Dashboard Beta-2` in `team-beta`
11. Create folder `staging` in provisioned root
12. Create `Dashboard Staging-1` in `staging`

**Important:** All resources MUST be created through the provisioned folder UI ("New" dropdown in the provisioned folder browse page). Do not use the Grafana REST API (`POST /api/dashboards/db` or `POST /api/folders`) -- those create regular (non-provisioned) resources that won't appear in the provisioned folder tree and won't work with branch-based move/delete in later phases.

**If creation repeatedly fails:** If the same bug blocks multiple resources after 2-3 successful creations, document the bug and move to Step 4 with whatever exists. The minimum viable set for later phases is:

- 2 top-level folders (needed for bulk move in Step 13)
- 1 dashboard in each folder (needed for bulk delete verification)
- 1 nested subfolder (needed for depth verification)

### Step 4: Verify Creation

Navigate through all 3 levels. Confirm:

- 3 top-level folders (`team-alpha`, `team-beta`, `staging`) in the provisioned root
- Dashboards at each level
- `alpha-monitoring` is 3 levels deep (provisioned root -> `team-alpha` -> `alpha-services` -> `alpha-monitoring`)

---

## Phase B: Viewer Restrictions (Steps 5-6)

### Step 5: Switch to Viewer

Log out and log in as `viewer-test` / `viewer-test`. See "Switch Browser User" in `../git-sync-shared/operations.md`.

1. `navigate_page` to `http://localhost:3000/logout`
2. `wait_for` text `["Log in"]` or `["Welcome to Grafana"]`
3. `fill` username input (`data-testid="data-testid Username input field"`) with `viewer-test`
4. `fill` password input (`data-testid="data-testid Password input field"`) with `viewer-test`
5. `click` login button (`data-testid="data-testid Login button"`)
6. If prompted, `click` skip password change (`data-testid="data-testid Skip change password button"`)
7. **Verify login:** Navigate to the provisioned root. Before checking restrictions, confirm you are logged in as `viewer-test` -- the user menu (bottom-left avatar) or `/profile` page should show the username. If you see admin-only controls (e.g., "New" button, checkboxes), you are not logged in as the correct user.

### Step 6: Verify Viewer Restrictions

1. **Can browse:** Navigate to the provisioned root folder. Confirm `team-alpha`, `team-beta`, `staging` folders are visible.
2. **Can view dashboards:** Navigate to `Dashboard Alpha-1` in `team-alpha`. Confirm the dashboard loads.
3. **No "New" button:** On the provisioned root folder browse page, confirm no "New" dropdown button is present.
4. **No bulk checkboxes:** Confirm no item checkboxes are visible in the browse view.
5. **No folder actions:** Confirm no "Folder actions" dropdown buttons on folder rows.
6. **Admin pages blocked:** `navigate_page` to `http://localhost:3000/admin/provisioning`. Confirm Grafana redirects to the Home page instead of showing provisioning admin content -- Viewers cannot access provisioning admin.

---

## Phase C: Editor Operations (Steps 7-10)

### Step 7: Switch to Editor

Log out and log in as `editor-test` / `editor-test`. Same procedure as Step 5.

1. `navigate_page` to `http://localhost:3000/logout`
2. `wait_for` text `["Log in"]` or `["Welcome to Grafana"]`
3. `fill` username input with `editor-test`
4. `fill` password input with `editor-test`
5. `click` login button
6. If prompted, `click` skip password change
7. **Verify login:** Navigate to the provisioned root and confirm you are logged in as `editor-test` via the user menu or `/profile` page.

### Step 8: Editor Creates Resources (Write Workflow)

The Editor can create folders and dashboards in provisioned folders.

1. **Create folder `editor-folder`** in the provisioned root. Use "Creating a New Folder" from `../git-sync-shared/operations.md`. Use the configured branch (`agent-test`).
2. **Create `Dashboard Editor-1`** in `editor-folder`. Use "Creating a New Dashboard" from `../git-sync-shared/operations.md`. Use the configured branch.

### Step 9: Editor Modifies and Deletes (Write Workflow)

1. **Modify `Dashboard Editor-1`:** Navigate to the dashboard. Edit it -- change the panel title or add a text panel. Save using the configured branch. See "Modifying an Existing Dashboard" in `../git-sync-shared/operations.md`.
2. **Delete `Dashboard Editor-1`:** Open dashboard settings, click "Delete dashboard". In the drawer, use configured branch. See "Deleting a Single Dashboard" in `../git-sync-shared/operations.md`.
3. **Delete `editor-folder`:** Navigate to the provisioned root. Find `editor-folder` row, click "Folder actions" -> "Delete this folder". In the drawer, use configured branch. See "Deleting a Single Folder" in `../git-sync-shared/operations.md`.

### Step 10: Editor Verifies Admin Restrictions

1. **Admin pages blocked:** `navigate_page` to `http://localhost:3000/admin/provisioning`. Confirm Grafana redirects to the Home page instead of showing provisioning admin content -- Editors cannot access provisioning admin.

---

## Phase D: Admin Bulk & Cleanup (Steps 11-17)

### Step 11: Switch Back to Admin

Log out and log in as `admin` / `admin`.

1. `navigate_page` to `http://localhost:3000/logout`
2. `wait_for` text `["Log in"]` or `["Welcome to Grafana"]`
3. `fill` username input with `admin`
4. `fill` password input with `admin`
5. `click` login button
6. If prompted, `click` skip password change

### Step 12: Test Branch (PR) Workflow

Exercise the `branch` workflow (PR creation) to confirm it works alongside the `write` workflow. Both sub-steps are mandatory.

**12a. Modify a dashboard via PR:**

1. Navigate to `Dashboard Alpha-1` in `team-alpha`.
2. Edit the dashboard -- change the panel title or add a text panel.
3. Click "Save".
4. In the save drawer, **use a new branch name**: click the branch combobox (id: `provisioned-ref`) "Clear value" button, `click` the combobox, `type_text` the full branch name (e.g., `pr-test-modify`), then `press_key` `Enter` as a separate action. Before saving, verify the committed combobox value matches the full branch name exactly. The workflow auto-switches to `branch`.
5. Optionally fill the comment.
6. Click "Save".
7. **Verify intended behavior:** The page should navigate to a preview page and the PR banner should include an `Open pull request in GitHub` button. If the local/dev run instead only shows the generic `A new resource has been created in a branch in GitHub.` banner plus branch/base links, record that mismatch and use it only as a diagnostic cue, not as the expected success state.

**12b. Create a folder via PR:**

1. Navigate back to the provisioned root folder browse page.
2. Click "New" dropdown -> "New folder".
3. Fill the folder name (e.g., `pr-test-folder`).
4. **Use a new branch name**: click the branch combobox "Clear value" button, `click` the combobox, `type_text` the full branch name (e.g., `pr-test-folder-branch`), then `press_key` `Enter` as a separate action. Before clicking Create, verify the committed combobox value matches the full branch name exactly. The workflow auto-switches to `branch`.
5. Click "Create".
6. **Verify intended behavior:** The success banner should include `Open pull request in GitHub`. If the local/dev run instead only shows the generic GitHub branch-created banner and the URL gains a `new_pull_request_url` parameter, record that mismatch rather than treating it as the expected success UI.

**Note:** Resources created/modified via the `branch` workflow exist on PR branches, not the configured branch. They do not appear in the main browse view and do not affect subsequent steps.

### Step 13: Bulk Move (2 Folders) -- Write Workflow

See "Bulk Moving Resources" in `../git-sync-shared/operations.md`.

1. Navigate to the provisioned root folder.
2. Select the `team-beta` and `staging` folder checkboxes (2 folders containing 3 dashboards total).
3. Click "Move" in the action bar.
4. In the drawer, pick `team-alpha` as the target folder. Use configured branch.
5. Click "Move". Wait for the bulk-job summary table described in the shared operations doc; do not require literal `Job completed successfully` text.

### Step 14: Verify Move

Navigate to `team-alpha`. Confirm it now contains:

- `Dashboard Alpha-1`, `Dashboard Alpha-2` (original)
- `alpha-services/` with its nested content (original)
- `team-beta/` with `Dashboard Beta-1` and `Dashboard Beta-2` (moved)
- `staging/` with `Dashboard Staging-1` (moved)

### Step 15: Bulk Delete (All Remaining) -- Write Workflow

See "Bulk Deleting Resources" in `../git-sync-shared/operations.md`.

1. Navigate to the provisioned root folder.
2. Select the `team-alpha` checkbox (selects the folder and all its descendants -- the entire remaining tree).
3. Click "Delete" in the action bar.
4. In the drawer, use configured branch. Click "Delete". Wait for the bulk-delete summary table described in the shared operations doc; do not require literal `Job completed successfully` text.
5. **Verify:** Provisioned root folder should be empty (no folders or dashboards remain).

### Step 16: Remove Repository

Delete via API (no need to use the wizard UI):

```bash
curl -X DELETE -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/ops-test-repo
```

Verify:

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
  jq '.items | length'
# Should return 0
```

### Step 17: Delete Test Users & Final Verification

Delete the test users created in Step 1:

```bash
curl -X DELETE -u admin:admin http://localhost:3000/api/admin/users/$VIEWER_ID
curl -X DELETE -u admin:admin http://localhost:3000/api/admin/users/$EDITOR_ID
```

If the user IDs are no longer in the shell session, look them up first:

```bash
for login in viewer-test editor-test; do
  USER_ID=$(curl -s -u admin:admin "http://localhost:3000/api/users/lookup?loginOrEmail=$login" | jq -r '.id // empty')
  if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
    curl -s -X DELETE -u admin:admin "http://localhost:3000/api/admin/users/$USER_ID"
    echo "Deleted user: $login (id: $USER_ID)"
  fi
done
```

**Final verification:**

- Repositories: 0 (`curl ... /repositories | jq '.items | length'`)
- Test users: gone (lookup returns 404)
- Provisioned folder: removed with the repository
