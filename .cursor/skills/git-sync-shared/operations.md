# Git Sync Shared Operations

Shared wizard steps and post-wizard operations for GitHub PAT, GitHub App, GitLab token, and Bitbucket token flows. Each flow skill handles Step 1 (Connect) independently; Steps 2–5 and all post-wizard operations are shared.

## Overview

**Entry URL:** Use the provider-specific route from the calling skill, for example `http://localhost:3000/admin/provisioning/connect/github`, `.../connect/gitlab`, or `.../connect/bitbucket`.

The wizard has 5 steps. The Next button text always shows the _next step's name_ (e.g., "Configure repository", "Choose what to synchronize"), except on the last step where it says "Finish".

**Step heading format:** `{n}. {step title}` (e.g., "1. Connect", "2. Configure repository").

## Step 2: Configure Repository (connection)

1. `take_snapshot` to find the branch and path comboboxes
2. **Branch** (first `combobox`, value: `main`): Always set to `agent-test`. Click the "Clear value" button next to it, `click` the combobox, `type_text` `agent-test`, then `press_key` `Enter` as a **separate call** (do not use `submitKey` on `type_text` — it truncates the value). The branch must already exist on the remote; the wizard will error with `branch "X" not found` if it doesn't.
3. **Path** (second `combobox`): Always set to `dev`. `click` the combobox, `type_text` `dev`, then `press_key` `Enter`. Same free-text behavior as the branch field.
4. `click` the Next button (text: "Choose what to synchronize")

**Wait:** `wait_for` text `["3. Choose what to synchronize"]` with **30s timeout**.

## Step 3: Choose What to Synchronize (bootstrap)

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

## Step 4: Synchronize (synchronize)

**Skipped** when both the repo is empty and no local resources need migrating. In that case, you jump directly to Step 5.

1. `wait_for` text `["Begin synchronization"]` (loading text: "Checking repository status...")
2. `take_snapshot` to find the "Begin synchronization" button
3. `click` "Begin synchronization"
4. **Wait for job completion:** The sync job runs asynchronously. **Do not use `wait_for` here** — the MCP `wait_for` has a hard 30s internal timeout cap (see Gotchas). Instead, poll with `take_snapshot` every 10-15s until the "Choose additional settings" button is no longer disabled, or the heading changes to step 5. For small repos this takes seconds; for large repos (200+ files) it can take 1-2 minutes.
5. `click` the Next button (text: "Choose additional settings")

## Step 5: Additional Settings (finish)

1. `take_snapshot` to see available settings
2. Optionally configure:
   - **Sync Interval** (number input, placeholder: `60`, seconds)
   - **Read only** (checkbox)
   - **Branch workflow option** (checkbox) — GitHub/Bitbucket label: `Enable pull request option when saving`; GitLab label: `Enable merge request option when saving`
   - **Push to configured branch** (checkbox)
   - **Generate Dashboard Previews** (checkbox, GitHub-only, conditional on image renderer)
   - **Webhook URL** (text input, GitHub-only, placeholder: `https://grafana.example.com`)
3. `click` "Finish"
4. **Wait:** Page navigates to `/admin/provisioning/{repoName}`. `wait_for` the repository name or the provisioning settings page content.

**Done.** The repository is now configured and syncing.

## Wizard Step 5 Configuration for Full Testing

When setting up the repo in Step 5, to test all save workflows later, enable both workflow options:

1. `take_snapshot` to see the settings checkboxes.
2. Check the provider's branch workflow checkbox (`prWorkflow`) — `Enable pull request option when saving` for GitHub/Bitbucket, `Enable merge request option when saving` for GitLab. This enables the `branch` workflow.
3. Check **"Enable push to synchronized branch"** (`enablePushToConfiguredBranch`) -- enables the `write` workflow (direct commit).

This configures `workflows: ['write', 'branch']` on the repository, enabling both direct push and branch-based review flows in save dialogs. Without both enabled, only one workflow is available.

## Post-Wizard: Dashboard & Folder Operations

After the wizard completes and the repo is synced, the following operations can be tested against provisioned resources. All save/create dialogs use the same branch combobox to determine the workflow:

- **Configured branch** (e.g., `agent-test`) → `write` workflow → direct commit to the synced branch.
- **New/different branch** → `branch` workflow → opens a branch-based review flow. Provider text may say pull request or merge request, but the branch workflow mechanics are the same.
- Before clicking Create/Save/Move/Delete, take a fresh snapshot and confirm `provisioned-ref` shows the intended full value exactly. For `write` workflow it should still be `agent-test`; for `branch` workflow it must match the full new branch name. If the value is truncated or changed unexpectedly, clear it and re-enter it before submitting.

### Creating a New Folder

**Entry point:** Navigate to the provisioned folder browse page (`/dashboards/f/{folderUid}/`). Click the "New" dropdown button. Click "New folder" from the menu.

**Drawer opens with `NewProvisionedFolderForm`:**

1. `take_snapshot` to find the folder name input.
2. `fill` the folder name input (id: `folder-name-input`, placeholder: `Enter folder name`) with a test name (e.g., `test-subfolder`). Only alphanumeric characters, spaces, underscores, and hyphens are allowed.
3. **Branch selection (push to configured branch):** The branch combobox (id: `provisioned-ref`) defaults to the configured branch (e.g., `agent-test`). Leave it as-is for direct write, then take a fresh snapshot and verify the committed value is still exactly `agent-test` before clicking Create. The workflow auto-selects `write`.
4. Optionally `fill` the comment textarea (id: `provisioned-resource-form-comment`).
5. `click` the "Create" button.
6. **Wait:** Button shows "Creating...". `wait_for` navigation to `/dashboards/f/{newFolderUid}/`.

**For branch workflow variant:** In step 3, click the branch combobox "Clear value" button, `click` the combobox, `type_text` the full new branch name (e.g., `folder-test-branch`), then `press_key` `Enter` as a separate action. Take a fresh snapshot and verify the committed combobox value matches the full branch name exactly. Workflow auto-switches to `branch`. After clicking Create, the intended success state is a branch-created banner plus pull-request controls for the current provider (for example `Open pull request in GitHub` or `Open pull request in GitLab`). If local/dev instead only shows `A new resource has been created in a branch in {repoType}.` plus branch/base links and the URL gains `new_pull_request_url`, use those as diagnostic cues and record any missing button/text as a mismatch.

### Creating a New Dashboard

**Entry point:** Navigate to the provisioned folder browse page. Click "New" dropdown → "New dashboard". This navigates to `/dashboard/new?folderUid={uid}`.

**Dashboard editor opens.** Add a panel or make a visual change, then click "Save" (Ctrl+S or the save button in the toolbar).

**Save drawer opens with `SaveProvisionedDashboardForm` (new dashboard):**

1. `take_snapshot` to see the save form fields.
2. `fill` the Title input (id: `dashboard-title`) with a test name (e.g., `Test Dashboard`).
3. Optionally `fill` Description (id: `dashboard-description`).
4. Target folder is pre-selected from the URL's `folderUid`.
5. **Branch selection:** Same as folder creation. For `write` workflow, verify `provisioned-ref` still shows the configured branch (`agent-test`) before saving. For `branch` workflow, clear the combobox, type the full new branch name, press `Enter`, then verify the committed value matches exactly before saving.
6. Folder path (id: `folder-path`) and Filename (id: `dashboard-filename`) are auto-populated. Adjust if needed.
7. Optionally `fill` Comment (id: `provisioned-resource-form-comment`).
8. `click` the "Save" button.
9. **Wait:** Button shows "Saving...". For `write` workflow, a success notification appears and the page navigates to the new dashboard URL. For `branch` workflow, the page navigates to a preview page and the preview banner should include `Open pull request in {repoType}` or `View pull request in {repoType}`. If local/dev instead only shows the generic `A new resource has been created in a branch in {repoType}.` banner plus branch/base links, record that mismatch while still using preview-page navigation as diagnostic evidence that the drawer submitted.

### Modifying an Existing Dashboard

**Entry point:** Navigate to an existing provisioned dashboard (created in the previous step, or synced from the repo).

**Edit the dashboard:** Change a panel title, add a panel, or modify any visual element. Then click "Save".

**Save drawer opens with `SaveProvisionedDashboardForm` (existing dashboard):**

1. `take_snapshot` to see the save form. Title, Description, and Target folder are NOT shown for existing dashboards.
2. **Branch selection:** Same as above. For direct write, verify `provisioned-ref` still shows `agent-test` before saving. For PR workflow, clear the combobox, type the full new branch name, press `Enter`, then verify the committed value matches exactly before saving.
3. Path (id: `dashboard-path`) is shown read-only.
4. Optionally `fill` Comment (id: `provisioned-resource-form-comment`).
5. `click` the "Save" button.
6. **Wait:** Same as new dashboard -- notification for `write` workflow; for `branch` workflow, a preview page plus `Open pull request in {repoType}` or `View pull request in {repoType}` is the intended result. If only the generic branch-created banner appears, record that as a mismatch and use the preview navigation only as a diagnostic cue.

**Tabs:** The drawer has "Details" (default) and "Changes" tabs. `click` the "Changes" tab to verify the diff before saving.

### Bulk Moving Resources

**Entry point:** Navigate to the provisioned folder browse page (`/dashboards/f/{folderUid}/`). Select items via their checkboxes — use `take_snapshot` to find each item's checkbox by `data-testid="${uid} checkbox"` (aria-label: "Select"). An action bar replaces the filter bar when items are selected (`data-testid="manage-actions"`), showing "Move" and "Delete" buttons.

**Important:** You cannot mix provisioned and non-provisioned items in a selection. If you select items from different sources, a warning modal appears and blocks the operation. Also, repo root folder checkboxes are disabled — you can only select items inside the provisioned folder, not the folder itself.

1. `take_snapshot` to identify item checkboxes. `click` each item's checkbox to select it.
2. `click` the "Move" button in the action bar.
3. **Drawer opens with title "Bulk Move Provisioned Resources":**
   - Target Folder: `click` the folder picker (label: "Target Folder") and select the destination folder.
   - Branch (id: `provisioned-ref`): Same combobox as other provisioned operations. Use the configured branch for direct write, then take a fresh snapshot and verify the committed value is still exactly `agent-test` before clicking Move.
   - Comment (id: `provisioned-resource-form-comment`): Optional.
4. `click` the "Move" button (shows "Moving..." while in progress).
5. **Wait for job completion:** The move creates an async job. Poll with `take_snapshot` every 10-15s until the final summary table appears or an error is shown. The summary view is the canonical completion signal; do not require literal `Job completed successfully` text. Do not use `wait_for` -- it has a 30s timeout cap (see Gotchas).
6. **Verify:** Navigate to the target folder and confirm the moved items appear there.

### Deleting a Single Dashboard

**Entry point:** Navigate to the provisioned dashboard. Open dashboard settings via the gear icon in the toolbar or by appending `?editview=settings` to the current dashboard URL. Click the "Delete dashboard" button (`data-testid` from `selectors.pages.Dashboard.Settings.General.deleteDashBoard`).

**Drawer opens with title "Delete Provisioned Dashboard" (subtitle: dashboard title):**

1. Branch (id: `provisioned-ref`): Same combobox. Use the configured branch, then take a fresh snapshot and verify the committed value is still exactly `agent-test` before deleting.
2. Comment (id: `provisioned-resource-form-comment`): Optional.
3. `click` the "Delete dashboard" button (shows "Deleting..." while in progress).
4. **Wait for completion:** Poll with `take_snapshot` until the job completes, the page navigates to `/dashboards`, or an error appears.

### Deleting a Single Folder

**Entry point:** Navigate to the parent folder in browse view. Find the target folder's row. Click the "Folder actions" dropdown button on that row, then click "Delete this folder" from the menu (destructive styling).

**Drawer opens with title "Delete provisioned folder" (subtitle: folder title):**

- Warning: "This will delete this folder and all its descendants. In total, this will affect:" followed by a count of affected dashboards, folders, and panels.

1. Branch (id: `provisioned-ref`): Same combobox. Use the configured branch, then take a fresh snapshot and verify the committed value is still exactly `agent-test` before deleting.
2. Comment (id: `provisioned-resource-form-comment`): Optional.
3. `click` the "Delete" button (destructive, shows "Deleting..." while in progress).
4. **Wait for completion:** Poll with `take_snapshot` until the job completes or an error appears.
5. **Verify:** Navigate back to the parent folder and confirm the folder and all its descendants are gone.

### Bulk Deleting Resources

**Entry point:** Same as bulk move -- select items via checkboxes in the browse view, then click "Delete" in the action bar.

**Drawer opens with title "Bulk Delete Provisioned Resources":**

- Warning: "This will delete selected folders and their descendants. In total, this will affect:" followed by a descendant count showing dashboards, folders, and panels.

1. Branch (id: `provisioned-ref`): Same combobox. Use the configured branch, then take a fresh snapshot and verify the committed value is still exactly `agent-test` before clicking Delete.
2. Comment (id: `provisioned-resource-form-comment`): Optional.
3. `click` the "Delete" button (destructive, shows "Deleting..." while in progress).
4. **Wait for job completion:** Poll with `take_snapshot` every 10-15s until the final summary table appears or an error is shown. The summary view is the canonical completion signal; do not require literal `Job completed successfully` text.
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

## User Management

### Create Test Users via API

Create users with specific roles for permission testing. New users default to the Admin org role — you must explicitly downgrade them.

**Create a Viewer user:**

```bash
VIEWER_ID=$(curl -s -X POST -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/admin/users \
  -d '{"login":"viewer-test","password":"viewer-test","email":"viewer@test.com","name":"Viewer Test"}' | jq -r '.id')

curl -s -X PATCH -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/org/users/$VIEWER_ID \
  -d '{"role":"Viewer"}'
```

**Create an Editor user:**

```bash
EDITOR_ID=$(curl -s -X POST -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/admin/users \
  -d '{"login":"editor-test","password":"editor-test","email":"editor@test.com","name":"Editor Test"}' | jq -r '.id')

curl -s -X PATCH -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/org/users/$EDITOR_ID \
  -d '{"role":"Editor"}'
```

### Switch Browser User

To test as a different user, log out and log back in:

1. `navigate_page` to `http://localhost:3000/logout` — destroys session cookie, redirects to `/login`
2. `wait_for` text `["Log in"]` or `["Welcome to Grafana"]`
3. `fill` username input (`data-testid="data-testid Username input field"`) with the username
4. `fill` password input (`data-testid="data-testid Password input field"`) with the password
5. `click` login button (`data-testid="data-testid Login button"`)
6. If prompted, `click` skip password change (`data-testid="data-testid Skip change password button"`)
7. `wait_for` the Grafana home page or navigate to the target URL

### Delete Test Users

```bash
curl -X DELETE -u admin:admin http://localhost:3000/api/admin/users/$VIEWER_ID
curl -X DELETE -u admin:admin http://localhost:3000/api/admin/users/$EDITOR_ID
```

## API Repository Setup

Create a repository and sync it without using the wizard.

For provider-specific create payloads, use the API reference in `../git-sync-shared/api.md` under **Create Repository via API**. GitHub PAT resource-ops runs still use the GitHub payload there; GitLab and Bitbucket token flows use the provider-specific variants.

### Step 1: Create the Repository

Pick the payload for your provider and POST it to the repositories endpoint:

```bash
curl -s -X POST -u admin:admin \
  -H 'Content-Type: application/json' \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories \
  -d @repository.json
```

Required payload differences:

| Provider        | `spec.type` | Config block | Token env var                   | Extra field                                        |
| --------------- | ----------- | ------------ | ------------------------------- | -------------------------------------------------- |
| GitHub PAT      | `github`    | `github`     | `GIT_SYNC_TEST_PAT`             | `generateDashboardPreviews` optional               |
| GitLab token    | `gitlab`    | `gitlab`     | `GIT_SYNC_TEST_GITLAB_TOKEN`    | none                                               |
| Bitbucket token | `bitbucket` | `bitbucket`  | `GIT_SYNC_TEST_BITBUCKET_TOKEN` | `tokenUser: "$GIT_SYNC_TEST_BITBUCKET_TOKEN_USER"` |

### Step 2: Trigger Initial Sync

```bash
JOB_NAME=$(curl -s -X POST -u admin:admin \
  -H 'Content-Type: application/json' \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/REPO_NAME/jobs \
  -d '{"action":"pull","pull":{}}' | jq -r '.metadata.name')
```

### Step 3: Wait for Sync Completion

Poll the job status every 5s until `state` is `success`:

```bash
for i in $(seq 1 30); do
  STATE=$(curl -s -u admin:admin \
    "http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/REPO_NAME/jobs/$JOB_NAME" | \
    jq -r '.status.state')
  echo "Job state: $STATE ($i/30)"
  if [ "$STATE" = "success" ]; then break; fi
  if [ "$STATE" = "error" ]; then echo "ERROR: Sync failed"; break; fi
  sleep 5
done
```

### Step 4: Verify

Browse to the provisioned folder in Grafana to confirm resources are visible, or check via API:

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
  jq '.items[] | {name: .metadata.name, type: .spec.type, url: (.spec.github.url // .spec.gitlab.url // .spec.bitbucket.url // .spec.git.url)}'
```
