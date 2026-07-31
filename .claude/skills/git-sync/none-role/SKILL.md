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

See "Create Test Users via API" in `../shared/operations.md` (None-role block). Create `none-test` — role `None`, password = login, email `none@test.com`.

**Verify** the role was set correctly:

```bash
curl -s -u admin:admin "http://localhost:3000/api/org/users" | \
  jq '.[] | select(.login == "none-test") | {login, role}'
# Should show: {"login": "none-test", "role": "None"}
```

### Step 2: Create Repository via API

See "Create Repository via API" and "Create Sync Job" in `../shared/api.md`. Substitute these parameters into the GitHub PAT payload:

- `metadata.name`: `none-test-repo`
- `spec.title`: `"None Test Repository"`
- `type`: `github`
- url: `$GIT_SYNC_TEST_PAT_REPO_URL`
- branch: `agent-test`
- `path`: `dev/none-test`
- `sync`: `{enabled: true, target: folder, intervalSeconds: 60}`
- `workflows`: `["write"]` (write only — no branch workflow)
- token: `$GIT_SYNC_TEST_PAT`

Trigger the initial sync and poll until `success` (see Create Sync Job).

### Step 3: Create Test Resources as Admin

Logged in as **admin**. Create one folder and one dashboard inside the provisioned root to verify the None-role user cannot see them.

1. **Create folder `test-folder`** in the provisioned root. Use "Creating a New Folder" from `../shared/operations.md`. Use the configured branch (`agent-test`).
2. **Create `Dashboard Test-1`** inside `test-folder`. Use "Creating a New Dashboard" from `../shared/operations.md`. Use the configured branch.
3. **Verify creation:** Navigate to the provisioned root folder. Confirm `test-folder` is visible and contains `Dashboard Test-1`.

**Capture URLs:** Record the direct URLs for both `test-folder` and `Dashboard Test-1` -- these will be used in Phase B to test direct URL access as the None-role user.

---

## Phase B: None Role Restrictions (Steps 4-8)

### Step 4: Switch to None-Role User

Log out and log in as `none-test` / `none-test` — see "Switch Browser User" in `../shared/operations.md`.

- **Verify login:** Navigate to `/profile` or check the user menu to confirm you are logged in as `none-test`. If you see admin-only controls or provisioned resources in the sidebar, you are not logged in as the correct user.

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

Log out and log in as `admin` / `admin` — see "Switch Browser User" in `../shared/operations.md`.

### Step 10: Delete Repository, User, and Verify

Run `bash .claude/skills/git-sync/shared/scripts/cleanup-provisioning.sh` — expected output includes `Remaining repositories: 0`.

**Delete the none-test user:**

```bash
NONE_ID=$(curl -s -u admin:admin "http://localhost:3000/api/users/lookup?loginOrEmail=none-test" | jq -r '.id // empty')
if [ -n "$NONE_ID" ] && [ "$NONE_ID" != "null" ]; then
  curl -s -X DELETE -u admin:admin "http://localhost:3000/api/admin/users/$NONE_ID"
  echo "Deleted user: none-test (id: $NONE_ID)"
fi
```

**Final verification:**

- Repositories: confirm cleanup script reported `Remaining repositories: 0`
- Test user: gone (lookup returns 404)
- Provisioned folder: removed with the repository
