---
name: test-git-sync-github-app
description: >
  Use when asked to test the GitHub App flow of Git Sync provisioning. Runs
  the 5-step wizard with GitHub App auth (connection creation, PEM injection),
  then exercises the full lifecycle: create resources, move, delete, remove
  repository, and delete the connection.
---

# Git Sync GitHub App Flow E2E Testing

Drive the Grafana provisioning wizard through the browser using `mcp_chrome_devtools_*` tools with GitHub App authentication.

## Prerequisites

### Required Feature Toggles

Grafana must have these feature toggles enabled: `provisioning`, `kubernetesDashboards`, and `provisioningFolderMetadata`.

### Required Secrets

| Variable                                    | Description                                    |
| ------------------------------------------- | ---------------------------------------------- |
| `GIT_SYNC_TEST_APP_REPO_URL`                | GitHub repo URL for GitHub App flow            |
| `GIT_SYNC_TEST_GITHUB_APP_ID`               | GitHub App ID, numeric                         |
| `GIT_SYNC_TEST_GITHUB_APP_INSTALLATION_ID`  | GitHub App Installation ID, numeric            |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY_PATH` | Path to PEM private key file (local)           |
| `GIT_SYNC_TEST_GITHUB_APP_PRIVATE_KEY`      | PEM private key content (cloud)                |

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

- **Operations** (Steps 2–5, create/move/delete, cleanup): `../git-sync-shared/operations.md`
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
12. `take_snapshot` to find the repo combobox. `click` it, then `type_text` to filter for the repo matching `$GIT_SYNC_TEST_APP_REPO_URL`. **Options may not appear in the a11y snapshot** — use `evaluate_script` to inspect and click the correct `[role="option"]` by DOM id (same technique as step 6 above).
13. `click` "Configure repository"

**Wait:** Same as PAT flow -- `wait_for` step 2 heading with **30s timeout**.

**Continue with Steps 2–5** from `../git-sync-shared/operations.md`. Steps 2–5 are identical to the PAT flow.

## Self-Contained Test Lifecycle

The operations must be tested end-to-end. This lifecycle creates resources, exercises all operations (create, move, delete), and removes the repository and connection — leaving zero artifacts.

### Setup

Run the complete wizard (Steps 1–5) with both `prWorkflow` and `enablePushToConfiguredBranch` enabled (see "Wizard Step 5 Configuration for Full Testing" in operations.md).

**Use path `dev/app-test` in Step 2** to avoid conflicts with other flows (see "Path Conflicts Across Repositories" gotcha).

All operations below use the **configured branch** (`write` workflow / direct commit).

### Step 1: Create Resources (3-Level Tree)

Build the following folder/dashboard tree inside the provisioned root. Use "Creating a New Folder" and "Creating a New Dashboard" from operations.md for each resource.

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

### Step 2: Verify Creation

Navigate through all 3 levels. Confirm:

- 3 top-level folders (`team-alpha`, `team-beta`, `staging`) in the provisioned root
- Dashboards at each level
- `alpha-monitoring` is 3 levels deep (provisioned root → `team-alpha` → `alpha-services` → `alpha-monitoring`)

### Step 3: Bulk Move (2 Folders)

1. Navigate to the provisioned root folder.
2. Select the `team-beta` and `staging` folder checkboxes (2 folders containing 3 dashboards total).
3. Click "Move" in the action bar.
4. In the drawer, pick `team-alpha` as the target folder. Use configured branch.
5. Click "Move". Wait for "Job completed successfully".

### Step 4: Verify Move

Navigate to `team-alpha`. Confirm it now contains:

- `Dashboard Alpha-1`, `Dashboard Alpha-2` (original)
- `alpha-services/` with its nested content (original)
- `team-beta/` with `Dashboard Beta-1` and `Dashboard Beta-2` (moved)
- `staging/` with `Dashboard Staging-1` (moved)

### Step 5: Delete Single Dashboard

1. Navigate to `Dashboard Beta-1` inside `team-alpha/team-beta/`.
2. Open dashboard settings. Click "Delete dashboard".
3. In the drawer, use configured branch. Click "Delete dashboard". Wait for completion.

### Step 6: Verify Single Dashboard Delete

Navigate to `team-alpha/team-beta/`. Confirm `Dashboard Beta-1` is gone but `Dashboard Beta-2` still exists.

### Step 7: Delete Single Folder

1. Navigate to `team-alpha` in the browse view.
2. Find the `staging` folder row. Click "Folder actions" → "Delete this folder".
3. In the drawer, use configured branch. Click "Delete". Wait for completion.

### Step 8: Verify Single Folder Delete

Navigate to `team-alpha`. Confirm:

- `staging` folder is gone **and** `Dashboard Staging-1` (its child) is also gone (cascade delete).
- `team-beta` (with `Dashboard Beta-2`) and `alpha-services` subtree still exist.

### Step 9: Bulk Delete (All Remaining)

1. Navigate to the provisioned root folder.
2. Select the `team-alpha` checkbox (selects the folder and all its descendants — the entire remaining tree).
3. Click "Delete" in the action bar.
4. In the drawer, use configured branch. Click "Delete". Wait for "Job completed successfully".

### Step 10: Verify Bulk Delete

Provisioned root folder should be empty (no folders or dashboards remain).

### Step 11: Remove Repository

Follow "Removing the Repository" from operations.md:

1. Navigate to `/admin/provisioning/{repoName}/edit`.
2. Click "Delete" dropdown → "Delete and remove resources (default)".
3. Confirm in modal. Wait for navigation to `/admin/provisioning`.

### Step 12: Verify Cleanup

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
  jq '.items | length'
# Should return 0
```

**Also delete the GitHub App connection** (PAT flow does not create connections, but GitHub App does):

```bash
BASE="http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default"
for name in $(curl -s -u admin:admin "$BASE/connections" | jq -r '.items[].metadata.name // empty'); do
  curl -s -X DELETE -u admin:admin "$BASE/connections/$name"
done
```

Verify no connections remain:

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/connections | \
  jq '.items | length'
# Should return 0
```
