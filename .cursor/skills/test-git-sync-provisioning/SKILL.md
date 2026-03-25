---
name: test-git-sync-provisioning
description: >
  Use when asked to test or exercise the Grafana Git Sync provisioning wizard and
  provisioned resource operations end-to-end via browser automation. Covers the 5-step
  wizard (PAT and GitHub App auth), dashboard CRUD, folder creation, and both
  direct-push and PR workflows for provisioned resources.
---

# Git Sync Provisioning Wizard E2E Testing

Drive the Grafana provisioning wizard through the browser using `mcp_chrome_devtools_*` tools.

## Prerequisites

### Required Feature Toggles

Grafana must have these feature toggles enabled: `provisioning`, `kubernetesDashboards`, and `provisioningFolderMetadata`.

### Required Secrets

| Variable                                    | Description                                                          |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `GIT_SYNC_TEST_PAT_REPO_URL`                | GitHub repo URL for PAT flow (e.g., `https://github.com/owner/repo`) |
| `GIT_SYNC_TEST_PAT`                         | GitHub Personal Access Token                                         |
| `GIT_SYNC_TEST_APP_REPO_URL`                | GitHub repo URL for GitHub App flow                                  |
| `GIT_SYNC_TEST_GITHUB_APP_ID`               | GitHub App ID, numeric                                               |
| `GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`  | GitHub App Installation ID, numeric                                  |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` | Path to PEM private key file (local)                                 |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY`      | PEM private key content (cloud)                                      |

For PAT flow only, the first two variables are sufficient.

### Local Setup

1. Create `.env` in the project root with credentials (see `.env.example`). Ensure `.env` is in `.gitignore`.
2. Source the credentials:
   ```bash
   source .cursor/skills/test-git-sync-provisioning/scripts/load-env.sh
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
   for var in GIT_SYNC_TEST_PAT_REPO_URL GIT_SYNC_TEST_PAT GIT_SYNC_TEST_APP_REPO_URL \
              GIT_SYNC_TEST_GITHUB_APP_ID GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID \
              GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY; do
     if [ -z "${!var}" ]; then echo "ERROR: $var is not set"; exit 1; fi
     echo "OK: $var is set"
   done
   ```

5. **Log in to Grafana:** Open browser to `http://localhost:3000`. Log in as `admin`/`admin`. Skip password change if prompted.

### Cleanup Before Testing

Before running any flow, delete existing test resources to avoid conflicts:

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

### References

- Element selectors: `references/selectors.md`
- API cleanup endpoints: `references/api.md`

## Overview

**Entry URL:** `http://localhost:3000/admin/provisioning/connect/github`

The wizard has 5 steps. The Next button text always shows the _next step's name_ (e.g., "Configure repository", "Choose what to synchronize"), except on the last step where it says "Finish".

**Step heading format:** `{n}. {step title}` (e.g., "1. Connect", "2. Configure repository").

## PAT Flow (Primary)

This is the simpler flow. Use `$GIT_SYNC_TEST_PAT_REPO_URL` and `$GIT_SYNC_TEST_PAT`.

### Step 1: Connect (authType)

1. `navigate_page` to `http://localhost:3000/admin/provisioning/connect/github`
2. `wait_for` text `["Connect with Personal Access Token"]`
3. `take_snapshot` to find the PAT radio button
4. `click` the radio option with label "Connect with Personal Access Token" (value: `pat`)
5. `fill` the token input (id: `token`) with `$GIT_SYNC_TEST_PAT`
6. `fill` the repository URL input (id: `repository-url`) with `$GIT_SYNC_TEST_PAT_REPO_URL`
7. `click` the Next button (text: "Configure repository")

**Wait:** The button shows "Submitting..." during K8s reconciliation. `wait_for` text `["2. Configure repository"]` (step 2 heading) with **30s timeout** before proceeding.

### Step 2: Configure Repository (connection)

1. `take_snapshot` to find the branch and path comboboxes
2. **Branch** (first `combobox`, value: `main`): Always set to `agent-test`. Click the "Clear value" button next to it, `click` the combobox, `type_text` `agent-test`, then `press_key` `Enter` as a **separate call** (do not use `submitKey` on `type_text` — it truncates the value). The branch must already exist on the remote; the wizard will error with `branch "X" not found` if it doesn't.
3. **Path** (second `combobox`): Always set to `dev`. `click` the combobox, `type_text` `dev`, then `press_key` `Enter`. Same free-text behavior as the branch field.
4. `click` the Next button (text: "Choose what to synchronize")

**Wait:** `wait_for` text `["3. Choose what to synchronize"]` with **30s timeout**.

### Step 3: Choose What to Synchronize (bootstrap)

The step loads async. `wait_for` the cards to appear (the loading text is "Loading resource information...").

1. `take_snapshot` to see available sync target cards
2. Two options:
   - **Instance**: "Sync all resources with external storage" -- syncs everything
   - **Folder**: "Sync external storage to a new Grafana folder" -- scoped sync
3. `click` the desired card
4. If **Folder** is selected: `fill` the display name input (id: `repository-title`, placeholder: `My repository connection`) with a descriptive name
5. `click` the Next button (text varies):
   - If repo has content: "Synchronize with external storage"
   - If repo is empty (no resources and no files): "Choose additional settings" (skips sync step)

### Step 4: Synchronize (synchronize)

**Skipped** when both the repo is empty and no local resources need migrating. In that case, you jump directly to Step 5.

1. `wait_for` text `["Begin synchronization"]` (loading text: "Checking repository status...")
2. `take_snapshot` to find the "Begin synchronization" button
3. `click` "Begin synchronization"
4. **Wait for job completion:** The sync job runs asynchronously. **Do not use `wait_for` here** — the MCP `wait_for` has a hard 30s internal timeout cap (see Gotchas). Instead, poll with `take_snapshot` every 10-15s until the "Choose additional settings" button is no longer disabled, or the heading changes to step 5. For small repos this takes seconds; for large repos (200+ files) it can take 1-2 minutes.
5. `click` the Next button (text: "Choose additional settings")

### Step 5: Additional Settings (finish)

1. `take_snapshot` to see available settings
2. Optionally configure:
   - **Sync Interval** (number input, placeholder: `60`, seconds)
   - **Read only** (checkbox)
   - **Enable pull request option when saving** (checkbox, GitHub-specific label)
   - **Push to configured branch** (checkbox)
   - **Generate Dashboard Previews** (checkbox, GitHub-only, conditional on image renderer)
   - **Webhook URL** (text input, GitHub-only, placeholder: `https://grafana.example.com`)
3. `click` "Finish"
4. **Wait:** Page navigates to `/admin/provisioning/{repoName}`. `wait_for` the repository name or the provisioning settings page content.

**Done.** The repository is now configured and syncing.

## GitHub App Flow (Secondary)

Requires `$GIT_SYNC_TEST_APP_REPO_URL`, `$GIT_SYNC_TEST_GITHUB_APP_ID`, `$GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`, and the PEM private key (via `$GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` locally or `$GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY` on cloud).

### Step 1: Connect (authType) -- GitHub App variant

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
12. `take_snapshot` to find the repo combobox. `click` it, then `type_text` to filter for the repo matching `$GIT_SYNC_TEST_APP_REPO_URL`. **Options may not appear in the a11y snapshot** — use `evaluate_script` to inspect and click the correct `[role="option"]` by DOM id (same technique as step 6 above).
13. `click` "Configure repository"

**Wait:** Same as PAT flow -- `wait_for` step 2 heading with **30s timeout**.

Steps 2-5 are identical to the PAT flow.

## Gotchas

### Kubernetes Reconciliation Delays

Every Next button click that submits data triggers a K8s resource write + reconciliation. The UI shows "Submitting..." on the button. **Never click the next element until the new step heading is visible.** Always `wait_for` the next step's title text or a known element on the new step.

### FormPrompt (Unsaved Changes Dialog)

The wizard uses `FormPrompt` which intercepts navigation when the form is dirty. This is active during the **bootstrap** and **synchronize** steps (not authType, connection, or finish). If you navigate away (e.g., back button or URL change) during these steps, a browser dialog appears asking to confirm. Use `handle_dialog` with `action: "accept"` if this happens.

### Loading States

Each step loads data asynchronously. Take a snapshot and check for these loading indicators before interacting:

- Bootstrap: "Loading resource information..."
- Synchronize: "Checking repository status..."

### Combobox Fields

Branch, path, and repository URL (in GitHub App mode) use `Combobox` components, not plain `input` elements. In the snapshot, they appear as `combobox` role. To interact:

1. `click` the combobox to open the dropdown
2. Either `type_text` to filter, then `click` the desired option from the dropdown
3. Or for **free-text entry** (e.g., a branch not in the pre-populated list): click the "Clear value" button if a value is pre-filled, `click` the combobox, `type_text` the value, then press `Enter`. The dropdown may appear empty — this is expected; `Enter` commits the typed value.

### Step Heading as Navigation Confirmation

The step heading format is `{n}. {title}` (e.g., "2. Configure repository"). Use this pattern in `wait_for` to confirm step transitions completed. **Always wait for the full heading with the step number** (e.g., `"3. Choose what to synchronize"`) rather than just the title text, to avoid false matches against the step indicator labels in the sidebar.

### Button Disabled States

The Next button may be disabled when:

- Form validation fails (required fields empty)
- Data is loading
- On the synchronize step: until the sync job completes successfully
- During submission ("Submitting..." state)

Always `take_snapshot` to verify the button is enabled before clicking.

### `wait_for` Timeout Cap

The Chrome DevTools MCP `wait_for` tool has a **hard 30-second internal timeout** regardless of the `timeout` value you pass. Any `wait_for` call that needs more than 30s will fail. For short waits (step transitions, button states), `wait_for` works fine. For long-running operations (sync jobs on large repos), **poll with `take_snapshot`** every 10-15s instead.

### Branch Must Exist

The `agent-test` branch (or whatever branch you configure in Step 2) must already exist on the remote repository. The wizard validates the branch and will error with `branch "X" not found` if it does not exist.

### Path Conflicts Across Repositories

When connecting more than one repository in different runs, use different path names in Step 2 to avoid conflicts. If two repositories sync to the same path (e.g., both use `dev`), the second connection may fail or overwrite the first. Use distinct paths per auth type (e.g., `dev/pat-test` for PAT, `dev/app-test` for GitHub App).

## Wizard Step 5 Configuration for Full Testing

When setting up the repo in Step 5, to test all save workflows later, enable both workflow options:

1. `take_snapshot` to see the settings checkboxes.
2. Check **"Enable pull request option when saving"** (`prWorkflow`) -- enables the `branch` workflow (PR creation).
3. Check **"Enable push to synchronized branch"** (`enablePushToConfiguredBranch`) -- enables the `write` workflow (direct commit).

This configures `workflows: ['write', 'branch']` on the repository, enabling both direct push and PR creation in save dialogs. Without both enabled, only one workflow is available.

## Post-Wizard: Dashboard & Folder Operations

After the wizard completes and the repo is synced, the following operations can be tested against provisioned resources. All save/create dialogs use the same branch combobox to determine the workflow:

- **Configured branch** (e.g., `agent-test`) → `write` workflow → direct commit to the synced branch.
- **New/different branch** → `branch` workflow → creates a PR.

### Creating a New Folder

**Entry point:** Navigate to the provisioned folder browse page (`/dashboards/f/{folderUid}/`). Click the "New" dropdown button. Click "New folder" from the menu.

**Drawer opens with `NewProvisionedFolderForm`:**

1. `take_snapshot` to find the folder name input.
2. `fill` the folder name input (id: `folder-name-input`, placeholder: `Enter folder name`) with a test name (e.g., `test-subfolder`). Only alphanumeric characters, spaces, underscores, and hyphens are allowed.
3. **Branch selection (push to configured branch):** The branch combobox (id: `provisioned-ref`) defaults to the configured branch (e.g., `agent-test`). Leave it as-is for direct write. The workflow auto-selects `write`.
4. Optionally `fill` the comment textarea (id: `provisioned-resource-form-comment`).
5. `click` the "Create" button.
6. **Wait:** Button shows "Creating...". `wait_for` navigation to `/dashboards/f/{newFolderUid}/`.

**For PR workflow variant:** In step 3, click the branch combobox "Clear value" button, `click` the combobox, `type_text` a new branch name (e.g., `folder-test-branch`), then `press_key` `Enter`. Workflow auto-switches to `branch`. After clicking Create, a PR alert banner appears with a link. The URL updates with `new_pull_request_url` parameter.

### Creating a New Dashboard

**Entry point:** Navigate to the provisioned folder browse page. Click "New" dropdown → "New dashboard". This navigates to `/dashboard/new?folderUid={uid}`.

**Dashboard editor opens.** Add a panel or make a visual change, then click "Save" (Ctrl+S or the save button in the toolbar).

**Save drawer opens with `SaveProvisionedDashboardForm` (new dashboard):**

1. `take_snapshot` to see the save form fields.
2. `fill` the Title input (id: `dashboard-title`) with a test name (e.g., `Test Dashboard`).
3. Optionally `fill` Description (id: `dashboard-description`).
4. Target folder is pre-selected from the URL's `folderUid`.
5. **Branch selection:** Same as folder creation -- configured branch for `write` workflow, new branch name for `branch` (PR) workflow.
6. Folder path (id: `folder-path`) and Filename (id: `dashboard-filename`) are auto-populated. Adjust if needed.
7. Optionally `fill` Comment (id: `provisioned-resource-form-comment`).
8. `click` the "Save" button.
9. **Wait:** Button shows "Saving...". For `write` workflow, a success notification appears and the page navigates to the new dashboard URL. For `branch` workflow, the page navigates to a preview page with a PR banner.

### Modifying an Existing Dashboard

**Entry point:** Navigate to an existing provisioned dashboard (created in the previous step, or synced from the repo).

**Edit the dashboard:** Change a panel title, add a panel, or modify any visual element. Then click "Save".

**Save drawer opens with `SaveProvisionedDashboardForm` (existing dashboard):**

1. `take_snapshot` to see the save form. Title, Description, and Target folder are NOT shown for existing dashboards.
2. **Branch selection:** Same as above. Configured branch for direct write, new branch name for PR workflow.
3. Path (id: `dashboard-path`) is shown read-only.
4. Optionally `fill` Comment (id: `provisioned-resource-form-comment`).
5. `click` the "Save" button.
6. **Wait:** Same as new dashboard -- notification for `write` workflow, preview page for `branch` workflow.

**Tabs:** The drawer has "Details" (default) and "Changes" tabs. `click` the "Changes" tab to verify the diff before saving.

### Bulk Moving Resources

**Entry point:** Navigate to the provisioned folder browse page (`/dashboards/f/{folderUid}/`). Select items via their checkboxes — use `take_snapshot` to find each item's checkbox by `data-testid="${uid} checkbox"` (aria-label: "Select"). An action bar replaces the filter bar when items are selected (`data-testid="manage-actions"`), showing "Move" and "Delete" buttons.

**Important:** You cannot mix provisioned and non-provisioned items in a selection. If you select items from different sources, a warning modal appears and blocks the operation. Also, repo root folder checkboxes are disabled — you can only select items inside the provisioned folder, not the folder itself.

1. `take_snapshot` to identify item checkboxes. `click` each item's checkbox to select it.
2. `click` the "Move" button in the action bar.
3. **Drawer opens with title "Bulk Move Provisioned Resources":**
   - Target Folder: `click` the folder picker (label: "Target Folder") and select the destination folder.
   - Branch (id: `provisioned-ref`): Same combobox as other provisioned operations. Use the configured branch for direct write.
   - Comment (id: `provisioned-resource-form-comment`): Optional.
4. `click` the "Move" button (shows "Moving..." while in progress).
5. **Wait for job completion:** The move creates an async job. Poll with `take_snapshot` every 10-15s until "Job completed successfully" appears, or an error message. Do not use `wait_for` — it has a 30s timeout cap (see Gotchas).
6. **Verify:** Navigate to the target folder and confirm the moved items appear there.

### Deleting a Single Dashboard

**Entry point:** Navigate to the provisioned dashboard. Open dashboard settings via the gear icon or navigate to `/dashboard/edit/{uid}/settings`. Click the "Delete dashboard" button (`data-testid` from `selectors.pages.Dashboard.Settings.General.deleteDashBoard`).

**Drawer opens with title "Delete Provisioned Dashboard" (subtitle: dashboard title):**

1. Branch (id: `provisioned-ref`): Same combobox. Use the configured branch.
2. Comment (id: `provisioned-resource-form-comment`): Optional.
3. `click` the "Delete dashboard" button (shows "Deleting..." while in progress).
4. **Wait for completion:** Poll with `take_snapshot` until the job completes or the page navigates to `/dashboards`.

### Deleting a Single Folder

**Entry point:** Navigate to the parent folder in browse view. Find the target folder's row. Click the "Folder actions" dropdown button on that row, then click "Delete this folder" from the menu (destructive styling).

**Drawer opens with title "Delete provisioned folder" (subtitle: folder title):**

- Warning: "This will delete this folder and all its descendants. In total, this will affect:" followed by a count of affected dashboards, folders, and panels.

1. Branch (id: `provisioned-ref`): Same combobox.
2. Comment (id: `provisioned-resource-form-comment`): Optional.
3. `click` the "Delete" button (destructive, shows "Deleting..." while in progress).
4. **Wait for completion:** Poll with `take_snapshot` until the job completes.
5. **Verify:** Navigate back to the parent folder and confirm the folder and all its descendants are gone.

### Bulk Deleting Resources

**Entry point:** Same as bulk move — select items via checkboxes in the browse view, then click "Delete" in the action bar.

**Drawer opens with title "Bulk Delete Provisioned Resources":**

- Warning: "This will delete selected folders and their descendants. In total, this will affect:" followed by a descendant count showing dashboards, folders, and panels.

1. Branch (id: `provisioned-ref`): Same combobox.
2. Comment (id: `provisioned-resource-form-comment`): Optional.
3. `click` the "Delete" button (destructive, shows "Deleting..." while in progress).
4. **Wait for job completion:** Poll with `take_snapshot` every 10-15s until "Job completed successfully" or an error.
5. **Verify:** Navigate to the parent folder and confirm all selected items and their descendants are gone.

### Removing the Repository

**Entry point:** Navigate to `/admin/provisioning/{repoName}/edit`.

1. `take_snapshot` to find the "Delete" dropdown button (destructive variant with angle-down icon).
2. `click` the "Delete" dropdown button.
3. `click` "Delete and remove resources (default)" from the dropdown menu.
4. **Confirmation modal** appears with title "Delete repository configuration and resources" and body "Are you sure you want to delete the repository configuration and all its resources?"
5. `click` the "Delete" button in the modal to confirm.
6. **Wait:** A notification "Repository settings queued for deletion" appears and the page navigates to `/admin/provisioning`.
7. **Verify cleanup:**
   ```bash
   curl -s -u admin:admin \
     http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
     jq '.items | length'
   # Should return 0 (or one less than before)
   ```

### Self-Contained Test Lifecycle

The operations above must be tested against **both** repository auth types (PAT and GitHub App). Each connected repository is independent. The lifecycle below creates resources, exercises all operations (create, move, delete), and removes the repository at the end — leaving zero artifacts.

**Run this lifecycle once for PAT, then again for GitHub App.**

#### Setup

Run the complete wizard (Steps 1–5) with both `prWorkflow` and `enablePushToConfiguredBranch` enabled (see "Wizard Step 5 Configuration for Full Testing" above).

**Use a distinct path in Step 2 for each auth type** to avoid conflicts (see "Path Conflicts Across Repositories" gotcha):

- PAT: path `dev/pat-test`
- GitHub App: path `dev/app-test`

All operations below use the **configured branch** (`write` workflow / direct commit).

#### Step 1: Create Resources (3-Level Tree)

Build the following folder/dashboard tree inside the provisioned root. Use "Creating a New Folder" and "Creating a New Dashboard" from the sections above for each resource.

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

#### Step 2: Verify Creation

Navigate through all 3 levels. Confirm:

- 3 top-level folders (`team-alpha`, `team-beta`, `staging`) in the provisioned root
- Dashboards at each level
- `alpha-monitoring` is 3 levels deep (provisioned root → `team-alpha` → `alpha-services` → `alpha-monitoring`)

#### Step 3: Bulk Move (2 Folders)

1. Navigate to the provisioned root folder.
2. Select the `team-beta` and `staging` folder checkboxes (2 folders containing 3 dashboards total).
3. Click "Move" in the action bar.
4. In the drawer, pick `team-alpha` as the target folder. Use configured branch.
5. Click "Move". Wait for "Job completed successfully".

#### Step 4: Verify Move

Navigate to `team-alpha`. Confirm it now contains:

- `Dashboard Alpha-1`, `Dashboard Alpha-2` (original)
- `alpha-services/` with its nested content (original)
- `team-beta/` with `Dashboard Beta-1` and `Dashboard Beta-2` (moved)
- `staging/` with `Dashboard Staging-1` (moved)

#### Step 5: Delete Single Dashboard

1. Navigate to `Dashboard Beta-1` inside `team-alpha/team-beta/`.
2. Open dashboard settings. Click "Delete dashboard".
3. In the drawer, use configured branch. Click "Delete dashboard". Wait for completion.

#### Step 6: Verify Single Dashboard Delete

Navigate to `team-alpha/team-beta/`. Confirm `Dashboard Beta-1` is gone but `Dashboard Beta-2` still exists.

#### Step 7: Delete Single Folder

1. Navigate to `team-alpha` in the browse view.
2. Find the `staging` folder row. Click "Folder actions" → "Delete this folder".
3. In the drawer, use configured branch. Click "Delete". Wait for completion.

#### Step 8: Verify Single Folder Delete

Navigate to `team-alpha`. Confirm:

- `staging` folder is gone **and** `Dashboard Staging-1` (its child) is also gone (cascade delete).
- `team-beta` (with `Dashboard Beta-2`) and `alpha-services` subtree still exist.

#### Step 9: Bulk Delete (All Remaining)

1. Navigate to the provisioned root folder.
2. Select the `team-alpha` checkbox (selects the folder and all its descendants — the entire remaining tree).
3. Click "Delete" in the action bar.
4. In the drawer, use configured branch. Click "Delete". Wait for "Job completed successfully".

#### Step 10: Verify Bulk Delete

Provisioned root folder should be empty (no folders or dashboards remain).

#### Step 11: Remove Repository

Follow "Removing the Repository" above:

1. Navigate to `/admin/provisioning/{repoName}/edit`.
2. Click "Delete" dropdown → "Delete and remove resources (default)".
3. Confirm in modal. Wait for navigation to `/admin/provisioning`.

#### Step 12: Verify Cleanup

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
  jq '.items | length'
# Should return 0
```

For the GitHub App flow, also delete the connection after removing the repository:

```bash
BASE="http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default"
for name in $(curl -s -u admin:admin "$BASE/connections" | jq -r '.items[].metadata.name // empty'); do
  curl -s -X DELETE -u admin:admin "$BASE/connections/$name"
done
```

#### Concrete Sequence

1. **PAT**: Setup (wizard with path `dev/pat-test`) → Create 3-level tree (12 resources) → Verify → Bulk Move (2 folders) → Verify → Single Delete Dashboard → Verify → Single Delete Folder → Verify → Bulk Delete (all) → Verify → Remove Repo → Verify Clean
2. **GitHub App**: Same lifecycle (wizard with path `dev/app-test`) → Remove Repo + Delete Connection → Verify Clean

## Cleanup

After testing, delete the created resources.

**Quick cleanup via API:**

```bash
BASE="http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default"
AUTH="admin:admin"

# Delete repositories first (must be deleted before their connections)
for name in $(curl -s -u "$AUTH" "$BASE/repositories" | jq -r '.items[].metadata.name'); do
  echo "Deleting repository: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/repositories/$name"
done

# Delete connections (GitHub App flow only)
for name in $(curl -s -u "$AUTH" "$BASE/connections" | jq -r '.items[].metadata.name // empty'); do
  echo "Deleting connection: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/connections/$name"
done

echo "Cleanup complete."
```

**Verify cleanup:**

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
  jq '.items | length'
# Should return 0
```

**Via UI:**

1. Navigate to `/admin/provisioning/{repoName}` -> "Delete" dropdown -> "Delete and remove resources" -> Confirm modal
2. For connections: `/admin/provisioning?tab=connections` -> find connection -> Delete
