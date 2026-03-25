---
name: test-git-sync-pat
description: >
  Use when asked to test the PAT (Personal Access Token) flow of Git Sync
  provisioning. Runs the 5-step wizard with PAT auth, then exercises the full
  lifecycle: create resources, move, delete, and remove the repository.
---

# Git Sync PAT Flow E2E Testing

Drive the Grafana provisioning wizard through the browser using `mcp_chrome_devtools_*` tools with PAT (Personal Access Token) authentication.

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

- **Operations** (Steps 2–5, create/move/delete, cleanup): `../git-sync-shared/operations.md`
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

**Continue with Steps 2–5** from `../git-sync-shared/operations.md`.

## Self-Contained Test Lifecycle

The operations must be tested end-to-end. This lifecycle creates resources, exercises all operations (create, move, delete), and removes the repository — leaving zero artifacts.

### Setup

Run the complete wizard (Steps 1–5) with both `prWorkflow` and `enablePushToConfiguredBranch` enabled (see "Wizard Step 5 Configuration for Full Testing" in operations.md).

**Use path `dev/pat-test` in Step 2** to avoid conflicts with other flows (see "Path Conflicts Across Repositories" gotcha).

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

No connection deletion needed for PAT flow — PAT does not create connections.
