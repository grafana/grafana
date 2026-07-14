---
name: none-role
description: >
  Use when asked to test provisioned resource access for a user with org role None —
  the lowest privilege level in Grafana's RBAC hierarchy. Creates a repository via API,
  creates test resources as admin, then verifies the None-role user cannot browse,
  view, or manage any provisioned resources.
---

# Git Sync None-Role Access Testing

Tests provisioned resource access restrictions for the `None` org role — the most restrictive role in Grafana's RBAC hierarchy. The None role has zero default permissions: no folder browsing, no dashboard viewing, no resource operations.

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
for login in none-test; do
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

## RBAC Permission Matrix — None Role

| Capability                            | None |
| ------------------------------------- | ---- |
| Browse provisioned folders/dashboards | No   |
| View dashboard content                | No   |
| Access folder by direct URL           | No   |
| Create/modify/delete resources        | No   |
| Access /admin/provisioning/\* pages   | No   |
| Repository/connection management      | No   |

The None role has **zero default permissions**. Unlike Viewer (which can browse and view), None cannot see any provisioned resources at all. The browse view returns empty, and direct URL access returns 403 or "access denied."

---

## Phase A: Admin Setup (Steps 1-3)

### Step 1: Create None-Role User

Create a `none-test` user via API and set the org role to `None`. See "Create Test Users via API" in `../shared/operations.md`.

```bash
NONE_ID=$(curl -s -X POST -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/admin/users \
  -d '{"login":"none-test","password":"none-test","email":"none@test.com","name":"None Test"}' | jq -r '.id')

curl -s -X PATCH -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/org/users/$NONE_ID \
  -d '{"role":"None"}'
echo "Created none-test with ID: $NONE_ID"
```

**Store the user ID** -- it is needed for cleanup in Step 10.

**Verify** the role was set correctly:

```bash
curl -s -u admin:admin "http://localhost:3000/api/org/users" | \
  jq '.[] | select(.login == "none-test") | {login, role}'
# Should show: {"login": "none-test", "role": "None"}
```

### Step 2: Create Repository via API

Create a PAT repository without the wizard. See "API Repository Setup" in `../shared/operations.md`.

```bash
curl -s -X POST -u admin:admin \
  -H 'Content-Type: application/json' \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories \
  -d '{
  "apiVersion": "provisioning.grafana.app/v0alpha1",
  "kind": "Repository",
  "metadata": {
    "name": "none-test-repo"
  },
  "spec": {
    "title": "None Test Repository",
    "description": "API-created repo for None-role access testing",
    "type": "github",
    "github": {
      "url": "'"$GIT_SYNC_TEST_PAT_REPO_URL"'",
      "branch": "agent-test",
      "generateDashboardPreviews": false,
      "path": "dev/none-test"
    },
    "sync": {
      "enabled": true,
      "target": "folder",
      "intervalSeconds": 60
    },
    "workflows": ["write"]
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
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/none-test-repo/jobs \
  -d '{"action":"pull","pull":{}}' | jq -r '.metadata.name')

for i in $(seq 1 30); do
  STATE=$(curl -s -u admin:admin \
    "http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/none-test-repo/jobs/$JOB_NAME" | \
    jq -r '.status.state')
  echo "Job state: $STATE ($i/30)"
  if [ "$STATE" = "success" ]; then break; fi
  if [ "$STATE" = "error" ]; then echo "ERROR: Sync failed"; break; fi
  sleep 5
done
```

### Step 3: Create Test Resources as Admin

Logged in as **admin**. Create one folder and one dashboard inside the provisioned root to verify the None-role user cannot see them.

1. **Create folder `test-folder`** in the provisioned root. Use "Creating a New Folder" from `../shared/operations.md`. Use the configured branch (`agent-test`).
2. **Create `Dashboard Test-1`** inside `test-folder`. Use "Creating a New Dashboard" from `../shared/operations.md`. Use the configured branch.
3. **Verify creation:** Navigate to the provisioned root folder. Confirm `test-folder` is visible and contains `Dashboard Test-1`.

**Capture URLs:** Record the direct URLs for both `test-folder` and `Dashboard Test-1` -- these will be used in Phase B to test direct URL access as the None-role user.

---

## Phase B: None Role Restrictions (Steps 4-8)

### Step 4: Switch to None-Role User

Log out and log in as `none-test` / `none-test`. See "Switch Browser User" in `../shared/operations.md`.

1. `navigate_page` to `http://localhost:3000/logout`
2. `wait_for` text `["Log in"]` or `["Welcome to Grafana"]`
3. `fill` username input (`data-testid="data-testid Username input field"`) with `none-test`
4. `fill` password input (`data-testid="data-testid Password input field"`) with `none-test`
5. `click` login button (`data-testid="data-testid Login button"`)
6. If prompted, `click` skip password change (`data-testid="data-testid Skip change password button"`)
7. **Verify login:** Navigate to `/profile` or check the user menu to confirm you are logged in as `none-test`. If you see admin-only controls or provisioned resources in the sidebar, you are not logged in as the correct user.

### Step 5: Verify Empty Browse

The None-role user should see no provisioned folders or dashboards.

1. **Browse page is empty:** Navigate to `/dashboards`. Confirm the provisioned root folder is NOT visible in the folder list. The None role returns an empty folder list -- no provisioned folders should appear.
2. **Direct folder URL denied:** Navigate directly to the provisioned root folder URL (e.g., `/dashboards/f/{provisionedRootUid}/`). Expect either:
   - An empty folder view (no children visible), OR
   - A 403 / "You don't have permission" page, OR
   - A redirect to the Home page
3. **Record the exact behavior** -- whether the provisioned root itself is accessible (but empty) or entirely blocked.

### Step 6: Verify Dashboard Access Denied

Navigate directly to the `Dashboard Test-1` URL captured in Phase A (e.g., `/d/{dashboardUid}/dashboard-test-1`).

**Expected:** The None-role user cannot view dashboard content. Expect one of:

- 403 status or "You don't have permission to see this page" message
- "Dashboard not found" error
- Redirect to the Home page

**Record the exact behavior** -- this documents whether Grafana returns a clear access-denied signal or a generic error.

### Step 7: Verify Folder Access Denied

Navigate directly to the `test-folder` URL captured in Phase A (e.g., `/dashboards/f/{folderUid}/`).

**Expected:** The None-role user cannot access the folder. Expect one of:

- 403 status or "You don't have permission to see this page" message
- Empty folder view (accessible but no content)
- Redirect to the Home page

**Record the exact behavior.**

### Step 8: Verify Admin Provisioning Blocked

Navigate to `http://localhost:3000/admin/provisioning`.

**Expected:** The None-role user cannot access provisioning admin. Confirm Grafana redirects to the Home page or shows a 403 / access-denied message. The None role has no admin permissions.

---

## Phase C: Cleanup (Steps 9-10)

### Step 9: Switch Back to Admin

Log out and log in as `admin` / `admin`.

1. `navigate_page` to `http://localhost:3000/logout`
2. `wait_for` text `["Log in"]` or `["Welcome to Grafana"]`
3. `fill` username input with `admin`
4. `fill` password input with `admin`
5. `click` login button
6. If prompted, `click` skip password change

### Step 10: Delete Repository, User, and Verify

**Delete repository via API:**

```bash
curl -X DELETE -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/none-test-repo
```

**Wait for repository deletion to complete** (resources are removed asynchronously):

```bash
for i in $(seq 1 15); do
  COUNT=$(curl -s -u admin:admin \
    http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
    jq '[.items[] | select(.metadata.name == "none-test-repo")] | length')
  if [ "$COUNT" = "0" ]; then echo "Repository deleted"; break; fi
  echo "Waiting for deletion... ($i/15)"
  sleep 5
done
```

**Delete the none-test user:**

```bash
NONE_ID=$(curl -s -u admin:admin "http://localhost:3000/api/users/lookup?loginOrEmail=none-test" | jq -r '.id // empty')
if [ -n "$NONE_ID" ] && [ "$NONE_ID" != "null" ]; then
  curl -s -X DELETE -u admin:admin "http://localhost:3000/api/admin/users/$NONE_ID"
  echo "Deleted user: none-test (id: $NONE_ID)"
fi
```

**Final verification:**

- Repositories: confirm `none-test-repo` no longer exists (`curl ... /repositories | jq '.items[] | select(.metadata.name == "none-test-repo")'` returns nothing)
- Test user: gone (lookup returns 404)
- Provisioned folder: removed with the repository
