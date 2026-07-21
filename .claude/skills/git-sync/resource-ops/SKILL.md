---
name: resource-ops
description: >
  Use when asked to test provisioned resource operations with multiple user
  roles (Admin, Editor, Viewer). Creates a repository via API, then exercises
  folder/dashboard CRUD, bulk move, bulk delete, and permission restrictions
  across all three roles.
---

# Git Sync Resource Operations & Permissions Testing

Tests provisioned resource operations across Admin, Editor, and Viewer roles. Sets up a repository via API (no wizard), creates test users, and exercises CRUD, bulk operations, and permission restrictions.

## Execution Rules

**This is a test-only run.** Read `../shared/execution-rules.md` FIRST and follow all of its rules: no code changes, do not stop on failure, complete the entire flow including cleanup, budget your time, and produce the final report in the format it defines.

## Prerequisites

### Required Feature Toggles

Grafana must have these feature toggles enabled: `provisioning`, `kubernetesDashboards`, and `provisioningFolderMetadata`.

### Required Secrets

| Variable                     | Description                                             |
| ---------------------------- | ------------------------------------------------------- |
| `GIT_SYNC_TEST_PAT_REPO_URL` | GitHub repo URL (e.g., `https://github.com/owner/repo`) |
| `GIT_SYNC_TEST_PAT`          | GitHub Personal Access Token                            |

Only PAT credentials are needed -- the simplest auth type for API-based setup.

### Setup

Follow "Local Setup" (or "Cloud Setup" on a cloud VM) in `../shared/setup.md`. Verify each variable from the Required Secrets table above is set before proceeding.

### Cleanup Before Testing

Before running, delete existing test resources and users to avoid conflicts:

Run `bash .claude/skills/git-sync/shared/scripts/cleanup-provisioning.sh`

```bash
AUTH="admin:admin"

# Delete test users (ignore 404 if they don't exist)
for login in viewer-test editor-test none-test; do
  USER_ID=$(curl -s -u "$AUTH" "http://localhost:3000/api/users/lookup?loginOrEmail=$login" | jq -r '.id // empty')
  if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
    curl -s -X DELETE -u "$AUTH" "http://localhost:3000/api/admin/users/$USER_ID"
    echo "Deleted user: $login (id: $USER_ID)"
  fi
done

echo "User cleanup complete."
```

## Shared References

Read these files during execution for detailed operation steps, gotchas, and selectors:

- **Operations** (create/move/delete resources, user management, API setup): `../shared/operations.md`
- **Gotchas** (reconciliation delays, combobox quirks, timeouts): `../shared/gotchas.md`
- **Selectors** (element IDs, roles, placeholders, login page): `../shared/selectors.md`
- **API reference** (repository CRUD, jobs, user management): `../shared/api.md`

## RBAC Permission Matrix

| Capability                             | None | Viewer | Editor | Admin |
| -------------------------------------- | ---- | ------ | ------ | ----- |
| Browse provisioned folders/dashboards  | No   | Yes    | Yes    | Yes   |
| View dashboard content                 | No   | Yes    | Yes    | Yes   |
| Create folders/dashboards (push jobs)  | No   | No     | Yes    | Yes   |
| Modify/save dashboards (push jobs)     | No   | No     | Yes    | Yes   |
| Delete resources (delete jobs)         | No   | No     | Yes    | Yes   |
| Move resources (move jobs)             | No   | No     | Yes    | Yes   |
| Access /admin/provisioning/\* pages    | No   | No     | No     | Yes   |
| Repository CRUD (create/update/delete) | No   | No     | No     | Yes   |
| Connection management                  | No   | No     | No     | Yes   |
| Trigger sync (pull jobs)               | No   | No     | No     | Yes   |

---

## Phase A: Admin Setup (Steps 1-4)

### Step 1: Create Test Users

See "Create Test Users via API" in `../shared/operations.md`. Create:

- `viewer-test` — role `Viewer`, password = login, email `viewer@test.com`
- `editor-test` — role `Editor`, password = login, email `editor@test.com`

### Step 2: Create Repository via API

See "Create Repository via API" and "Create Sync Job" in `../shared/api.md`. Substitute these parameters into the GitHub PAT payload:

- `metadata.name`: `ops-test-repo`
- `spec.title`: `"Ops Test Repository"`
- `type`: `github`
- url: `$GIT_SYNC_TEST_PAT_REPO_URL`
- branch: `agent-test`
- `path`: `dev/ops-test`
- `sync`: `{enabled: true, target: folder, intervalSeconds: 60}`
- `workflows`: `["write", "branch"]`
- token: `$GIT_SYNC_TEST_PAT`

Trigger the initial sync and poll until `success` (see Create Sync Job).

### Step 3: Create Resources (3-Level Tree) -- Write Workflow

Logged in as **admin**. Build the following folder/dashboard tree inside the provisioned root using the **configured branch** (`agent-test`). Use "Creating a New Folder" and "Creating a New Dashboard" from `../shared/operations.md` for each resource.

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

Create parents before children, top to bottom as drawn (12 resources: 6 folders, 6 dashboards).

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

Log out and log in as `viewer-test` / `viewer-test` — see "Switch Browser User" in `../shared/operations.md`.

- **Verify login:** Navigate to the provisioned root. Before checking restrictions, confirm you are logged in as `viewer-test` — the user menu (bottom-left avatar) or `/profile` page should show the username. If you see admin-only controls (e.g., "New" button, checkboxes), you are not logged in as the correct user.

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

Log out and log in as `editor-test` / `editor-test` — see "Switch Browser User" in `../shared/operations.md`.

- **Verify login:** Navigate to the provisioned root and confirm you are logged in as `editor-test` via the user menu or `/profile` page.

### Step 8: Editor Creates Resources (Write Workflow)

The Editor can create folders and dashboards in provisioned folders.

1. **Create folder `editor-folder`** in the provisioned root. Use "Creating a New Folder" from `../shared/operations.md`. Use the configured branch (`agent-test`).
2. **Create `Dashboard Editor-1`** in `editor-folder`. Use "Creating a New Dashboard" from `../shared/operations.md`. Use the configured branch.

### Step 9: Editor Modifies and Deletes (Write Workflow)

1. **Modify `Dashboard Editor-1`:** Navigate to the dashboard. Edit it -- change the panel title or add a text panel. Save using the configured branch. See "Modifying an Existing Dashboard" in `../shared/operations.md`.
2. **Delete `Dashboard Editor-1`:** Open dashboard settings, click "Delete dashboard". In the drawer, use configured branch. See "Deleting a Single Dashboard" in `../shared/operations.md`.
3. **Delete `editor-folder`:** Navigate to the provisioned root. Find `editor-folder` row, click "Folder actions" -> "Delete this folder". In the drawer, use configured branch. See "Deleting a Single Folder" in `../shared/operations.md`.

### Step 10: Editor Verifies Admin Restrictions

1. **Admin pages blocked:** `navigate_page` to `http://localhost:3000/admin/provisioning`. Confirm Grafana redirects to the Home page instead of showing provisioning admin content -- Editors cannot access provisioning admin.

---

## Phase D: Admin Bulk & Cleanup (Steps 11-17)

### Step 11: Switch Back to Admin

Log out and log in as `admin` / `admin` — see "Switch Browser User" in `../shared/operations.md`.

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

See "Bulk Moving Resources" in `../shared/operations.md`.

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

See "Bulk Deleting Resources" in `../shared/operations.md`.

1. Navigate to the provisioned root folder.
2. Select the `team-alpha` checkbox (selects the folder and all its descendants -- the entire remaining tree).
3. Click "Delete" in the action bar.
4. In the drawer, use configured branch. Click "Delete". Wait for the bulk-delete summary table described in the shared operations doc; do not require literal `Job completed successfully` text.
5. **Verify:** Provisioned root folder should be empty (no folders or dashboards remain).

### Step 16: Remove Repository

Run `bash .claude/skills/git-sync/shared/scripts/cleanup-provisioning.sh` — expected output includes `Remaining repositories: 0`.

### Step 17: Delete Test Users & Final Verification

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
