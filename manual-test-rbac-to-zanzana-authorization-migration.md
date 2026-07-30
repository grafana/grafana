# Manual test guide: RBAC-to-Zanzana migration

Use this guide to test every useful rollout state in this branch. For the design and migration plan, see [the RBAC-to-Zanzana design document](./design-doc-rbac-to-zanzana-authorization-migration.md).

The guide creates one main test user with:

- one legacy resource permission;
- native permissions stored through Kubernetes APIs;
- a generic permission stored through Kubernetes APIs; and
- one action that has both a native scope and a generic scope.

The same grants should work in every state with these files. The IAM APIs still
have the legacy SQL compatibility mirror available, so RBAC can read the mirrored
role and binding. Use configuration, metrics, and logs—not different HTTP
results—to confirm which engine is primary.

## Safety

Use a new local data directory. The test creates users, teams, a dashboard, a custom role, role bindings, and service-account tokens. Do not run it against a shared or production Grafana instance.

## Permissions used by the test

| Type                | Permission                                                    | What it proves                                         |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| Native, no scope    | `teams:create`                                                | Zanzana can use a direct mapping.                      |
| Native, wildcard    | `teams:write` on `teams:*`                                    | Team creation can add the creator as a team admin.     |
| Native, exact scope | `dashboards:read` on `dashboards:uid:migration-dashboard`     | Native merge and Zanzana can handle one resource.      |
| Generic             | `plugins.app:access` on `plugins:id:<app-plugin-id>`          | Zanzana can check a permission with no native mapping. |
| Mixed               | `roles:read` on `roles:*` and `roles:uid:migration-k8s-grant` | One action can use both native and generic scopes.     |
| Legacy control      | `teams:read` on one team                                      | A legacy resource permission still works.              |

## States to test

| State     | Returned legacy decision     | Native merge | Kubernetes-style client |
| --------- | ---------------------------- | ------------ | ----------------------- |
| `rbac`    | RBAC                         | Off          | Legacy                  |
| `shadow`  | RBAC; Zanzana runs in shadow | On           | Legacy                  |
| `zanzana` | Zanzana; RBAC runs in shadow | On           | Zanzana                 |

“Zanzana only” means that Zanzana controls authorization decisions. RBAC still runs in the background for comparison, and the local permission map still supports UI and inspection compatibility.

These three files test the decision rollout while the SQL compatibility mirror
still exists. They do not prove that RBAC or the UI can build a complete local
permission map after the authorization tables are removed. That Kubernetes-based
compatibility resolver is a later migration phase and is not implemented yet.

## 1. Create the three INI files

Run all commands from the repository root. Create one repository-local test directory:

```bash
export AUTHZ_TEST_DIR=./data/zanzana-migration-test
mkdir -p \
  "$AUTHZ_TEST_DIR/grafana" \
  "$AUTHZ_TEST_DIR/logs/rbac" \
  "$AUTHZ_TEST_DIR/logs/shadow" \
  "$AUTHZ_TEST_DIR/logs/zanzana"
```

All three files use the same data directory. Only decision routing, merge behavior, client selection, and log directory change.

`kubernetesAuthZResourcePermissionsRedirect` stays off so the fixture can keep one legacy RBAC permission. `kubernetesUsersRedirect` stays off so the test users can use local passwords.

### `grafana-rbac.ini`

Create `$AUTHZ_TEST_DIR/grafana-rbac.ini`:

```ini
app_mode = development

[paths]
data = data/zanzana-migration-test/grafana
logs = data/zanzana-migration-test/logs/rbac
plugins = data/plugins

[server]
http_addr = 127.0.0.1
http_port = 3000
root_url = http://localhost:3000/
router_logging = true
static_root_path = public

[security]
admin_user = admin
admin_password = admin

[enterprise]
license_path = data/license.jwt

[environment]
stack_id = 11

[rbac]
single_organization = true

[grafana-apiserver]
storage_type = unified

[unified_storage]
enable_search = true

[log]
level = debug
filters = accesscontrol:debug,zanzana:debug

[feature_toggles]
grafanaAPIServerWithExperimentalAPIs = false
kubernetesUsersApi = true
kubernetesUsersRedirect = false
kubernetesTeamsApi = true
kubernetesTeamsRedirect = true
kubernetesServiceAccountsApi = true
kubernetesServiceAccountTokensApi = true
kubernetesAuthzGlobalRolesApi = true
kubernetesAuthzRolesApi = true
kubernetesAuthzRoleBindingsApi = true
kubernetesAuthzResourcePermissionApis = true
kubernetesAuthzRolesAndRoleBindingsRedirect = true
kubernetesAuthzZanzanaSync = true
kubernetesAuthZResourcePermissionsRedirect = false
zanzana = false
zanzanaRBACFallbackChecks = false
zanzanaMergeUserPermissions = false
zanzanaNoLegacyClient = false

[zanzana.client]
primary_engine = rbac

[zanzana.reconciler]
mode = mt
interval = 2s
```

### `grafana-shadow.ini`

Create `$AUTHZ_TEST_DIR/grafana-shadow.ini`:

```ini
app_mode = development

[paths]
data = data/zanzana-migration-test/grafana
logs = data/zanzana-migration-test/logs/shadow
plugins = data/plugins

[server]
http_addr = 127.0.0.1
http_port = 3000
root_url = http://localhost:3000/
router_logging = true
static_root_path = public

[security]
admin_user = admin
admin_password = admin

[enterprise]
license_path = data/license.jwt

[environment]
stack_id = 11

[rbac]
single_organization = true

[grafana-apiserver]
storage_type = unified

[unified_storage]
enable_search = true

[log]
level = debug
filters = accesscontrol:debug,zanzana:debug

[feature_toggles]
grafanaAPIServerWithExperimentalAPIs = false
kubernetesUsersApi = true
kubernetesUsersRedirect = false
kubernetesTeamsApi = true
kubernetesTeamsRedirect = true
kubernetesServiceAccountsApi = true
kubernetesServiceAccountTokensApi = true
kubernetesAuthzGlobalRolesApi = true
kubernetesAuthzRolesApi = true
kubernetesAuthzRoleBindingsApi = true
kubernetesAuthzResourcePermissionApis = true
kubernetesAuthzRolesAndRoleBindingsRedirect = true
kubernetesAuthzZanzanaSync = true
kubernetesAuthZResourcePermissionsRedirect = false
zanzana = true
zanzanaRBACFallbackChecks = true
zanzanaMergeUserPermissions = true
zanzanaNoLegacyClient = false

[zanzana.client]
primary_engine = rbac

[zanzana.reconciler]
mode = mt
interval = 2s
```

### `grafana-zanzana.ini`

Create `$AUTHZ_TEST_DIR/grafana-zanzana.ini`:

```ini
app_mode = development

[paths]
data = data/zanzana-migration-test/grafana
logs = data/zanzana-migration-test/logs/zanzana
plugins = data/plugins

[server]
http_addr = 127.0.0.1
http_port = 3000
root_url = http://localhost:3000/
router_logging = true
static_root_path = public

[security]
admin_user = admin
admin_password = admin

[enterprise]
license_path = data/license.jwt

[environment]
stack_id = 11

[rbac]
single_organization = true

[grafana-apiserver]
storage_type = unified

[unified_storage]
enable_search = true

[log]
level = debug
filters = accesscontrol:debug,zanzana:debug

[feature_toggles]
grafanaAPIServerWithExperimentalAPIs = false
kubernetesUsersApi = true
kubernetesUsersRedirect = false
kubernetesTeamsApi = true
kubernetesTeamsRedirect = true
kubernetesServiceAccountsApi = true
kubernetesServiceAccountTokensApi = true
kubernetesAuthzGlobalRolesApi = true
kubernetesAuthzRolesApi = true
kubernetesAuthzRoleBindingsApi = true
kubernetesAuthzResourcePermissionApis = true
kubernetesAuthzRolesAndRoleBindingsRedirect = true
kubernetesAuthzZanzanaSync = true
kubernetesAuthZResourcePermissionsRedirect = false
zanzana = true
zanzanaRBACFallbackChecks = true
zanzanaMergeUserPermissions = true
zanzanaNoLegacyClient = true

[zanzana.client]
primary_engine = zanzana

[zanzana.reconciler]
mode = mt
interval = 2s
```

## 2. Start a state

Start in `shadow` so the fixture can reconcile into Zanzana:

```bash
./bin/grafana server \
  --homepath "$PWD" \
  --config "$AUTHZ_TEST_DIR/grafana-shadow.ini" \
  --packaging=dev
```

Create the fixture in the next section. Then test each state by stopping Grafana and restarting it with one of these files:

| State     | Config file                           |
| --------- | ------------------------------------- |
| `rbac`    | `$AUTHZ_TEST_DIR/grafana-rbac.ini`    |
| `shadow`  | `$AUTHZ_TEST_DIR/grafana-shadow.ini`  |
| `zanzana` | `$AUTHZ_TEST_DIR/grafana-zanzana.ini` |

Keep the same data directory. Wait for `/api/health` after every restart. In `shadow` and `zanzana`, also wait for `stacks-11` to report `inSync=true`.

In the API terminal, export:

```bash
export AUTHZ_TEST_DIR=./data/zanzana-migration-test
export GRAFANA_URL=http://localhost:3000
export GRAFANA_NAMESPACE=stacks-11
```

Check health:

```bash
curl -sS "$GRAFANA_URL/api/health" | jq
```

Check reconciliation after setting `TEST_STATE` to `shadow` or `zanzana`:

```bash
export TEST_STATE=shadow

rg 'Reconciled namespace.*namespace=stacks-11.*inSync=true' \
  "$AUTHZ_TEST_DIR/logs/$TEST_STATE/grafana.log"
```

You may also see an `org-0` error. Continue if `stacks-11` finishes with `inSync=true`.

## 3. Create the test data

Do this once while the `shadow` state is running.

### 3.1 Create three users

The main user gets the migration grants. The Viewer checks that normal basic-role access does not change. The denied user checks that the migration does not create new access.

```bash
PHASE_USER_JSON="$(
  curl -sS -u admin:admin \
    -H 'Content-Type: application/json' \
    -X POST "$GRAFANA_URL/api/admin/users" \
    -d '{
      "name":"Migration User",
      "email":"migration-user@example.test",
      "login":"migration-user",
      "password":"migration-password"
    }'
)"
export PHASE_USER_ID="$(jq -r '.id' <<<"$PHASE_USER_JSON")"
export PHASE_USER_UID="$(jq -r '.uid' <<<"$PHASE_USER_JSON")"

PHASE_VIEWER_JSON="$(
  curl -sS -u admin:admin \
    -H 'Content-Type: application/json' \
    -X POST "$GRAFANA_URL/api/admin/users" \
    -d '{
      "name":"Migration Viewer",
      "email":"migration-viewer@example.test",
      "login":"migration-viewer",
      "password":"migration-password"
    }'
)"
export PHASE_VIEWER_ID="$(jq -r '.id' <<<"$PHASE_VIEWER_JSON")"

PHASE_DENIED_JSON="$(
  curl -sS -u admin:admin \
    -H 'Content-Type: application/json' \
    -X POST "$GRAFANA_URL/api/admin/users" \
    -d '{
      "name":"Migration Denied",
      "email":"migration-denied@example.test",
      "login":"migration-denied",
      "password":"migration-password"
    }'
)"
export PHASE_DENIED_ID="$(jq -r '.id' <<<"$PHASE_DENIED_JSON")"
```

Give the main and denied users the `None` basic role. Keep the Viewer as `Viewer`:

```bash
curl -sS -u admin:admin \
  -H 'Content-Type: application/json' \
  -X PATCH "$GRAFANA_URL/api/org/users/$PHASE_USER_ID" \
  -d '{"role":"None"}' | jq

curl -sS -u admin:admin \
  -H 'Content-Type: application/json' \
  -X PATCH "$GRAFANA_URL/api/org/users/$PHASE_DENIED_ID" \
  -d '{"role":"None"}' | jq

curl -sS -u admin:admin \
  -H 'Content-Type: application/json' \
  -X PATCH "$GRAFANA_URL/api/org/users/$PHASE_VIEWER_ID" \
  -d '{"role":"Viewer"}' | jq
```

### 3.2 Pick an app plugin

The generic test needs an installed app plugin. Try the Assistant app first:

```bash
export APP_PLUGIN_ID=grafana-assistant-app

curl -sS -o /dev/null -w '%{http_code}\n' \
  -u admin:admin \
  "$GRAFANA_URL/api/plugins/$APP_PLUGIN_ID/settings"
```

If this returns `404`, list the installed app plugins:

```bash
curl -sS -u admin:admin "$GRAFANA_URL/api/plugins?type=app" \
  | jq -r '.[].id'
```

Set `APP_PLUGIN_ID` to one of those IDs. Check that its settings endpoint returns `200` for admin.

### 3.3 Create a dashboard

```bash
curl -sS -u admin:admin \
  -H 'Content-Type: application/json' \
  -X POST "$GRAFANA_URL/api/dashboards/db" \
  -d '{
    "dashboard":{
      "id":null,
      "uid":"migration-dashboard",
      "title":"Migration dashboard",
      "schemaVersion":42,
      "panels":[]
    },
    "overwrite":false
  }' | jq
```

### 3.4 Create a Kubernetes-backed team

`kubernetesTeamsRedirect` makes these legacy-shaped requests write through the Kubernetes Team API.

```bash
TEAM_JSON="$(
  curl -sS -u admin:admin \
    -H 'Content-Type: application/json' \
    -X POST "$GRAFANA_URL/api/teams" \
    -d '{
      "name":"Migration K8s team",
      "email":"migration-k8s-team@example.test"
    }'
)"
export MIGRATION_TEAM_ID="$(jq -r '.teamId' <<<"$TEAM_JSON")"
export MIGRATION_TEAM_UID="$(jq -r '.uid' <<<"$TEAM_JSON")"

curl -sS -u admin:admin \
  -H 'Content-Type: application/json' \
  -X POST "$GRAFANA_URL/api/teams/$MIGRATION_TEAM_ID/members" \
  -d "{\"userId\":$PHASE_USER_ID}" | jq
```

### 3.5 Add one legacy permission

This call stays on the legacy resource-permission path. It gives the main user `teams:read` for one team, but not `teams:create`.

```bash
curl -sS -u admin:admin \
  -H 'Content-Type: application/json' \
  -X POST \
  "$GRAFANA_URL/api/access-control/teams/$MIGRATION_TEAM_ID/users/$PHASE_USER_ID" \
  -d '{"permission":"Member"}' | jq
```

This is the known-good legacy control. Team search should keep working in every state.

### 3.6 Create the Kubernetes-backed role

Build the role with the plugin ID selected above:

```bash
jq -n --arg plugin "$APP_PLUGIN_ID" '{
  name: "migration-k8s-grant",
  uid: "migration-k8s-grant",
  displayName: "Migration K8s grant",
  group: "Migration test",
  permissions: [
    {action: "teams:create", scope: ""},
    {action: "teams:read", scope: "teams:*"},
    {action: "teams:write", scope: "teams:*"},
    {
      action: "dashboards:read",
      scope: "dashboards:uid:migration-dashboard"
    },
    {
      action: "plugins.app:access",
      scope: ("plugins:id:" + $plugin)
    },
    {action: "roles:read", scope: "roles:*"},
    {
      action: "roles:read",
      scope: "roles:uid:migration-k8s-grant"
    }
  ]
}' > "$AUTHZ_TEST_DIR/migration-role.json"

curl -sS -u admin:admin \
  -H 'Content-Type: application/json' \
  -X POST "$GRAFANA_URL/api/access-control/roles" \
  --data-binary @"$AUTHZ_TEST_DIR/migration-role.json" | jq

curl -sS -u admin:admin \
  -H 'Content-Type: application/json' \
  -X POST "$GRAFANA_URL/api/access-control/teams/$MIGRATION_TEAM_ID/roles" \
  -d '{"roleUid":"migration-k8s-grant"}' | jq
```

The role and team assignment are created through the Kubernetes IAM APIs. Their
backing storage and SQL mirroring depend on the IAM unified-storage mode. The
three INI files in this guide keep the current SQL compatibility mirror available.

The legacy team-create handler creates the Team and then updates it to make the
creator an administrator. `teams:create` authorizes the first operation.
`teams:write` on all teams authorizes the second operation.

Wait for `stacks-11` to reconcile again:

```bash
rg 'Reconciled namespace.*namespace=stacks-11.*inSync=true' \
  "$AUTHZ_TEST_DIR/logs/shadow/grafana.log" | tail -1
```

### 3.7 Log in and save cookies

```bash
curl -sS -c "$AUTHZ_TEST_DIR/migration-user.cookie" \
  -H 'Content-Type: application/json' \
  -X POST "$GRAFANA_URL/login" \
  -d '{"user":"migration-user","password":"migration-password"}' | jq

curl -sS -c "$AUTHZ_TEST_DIR/migration-viewer.cookie" \
  -H 'Content-Type: application/json' \
  -X POST "$GRAFANA_URL/login" \
  -d '{"user":"migration-viewer","password":"migration-password"}' | jq

curl -sS -c "$AUTHZ_TEST_DIR/migration-denied.cookie" \
  -H 'Content-Type: application/json' \
  -X POST "$GRAFANA_URL/login" \
  -d '{"user":"migration-denied","password":"migration-password"}' | jq
```

Create the cookies again if a request returns `401` after a restart.

## 4. Run the API checks

Add this helper to the API terminal. It prints the status code and saves the response body in `$AUTHZ_TEST_DIR/last-response.json`.

```bash
api_status() {
  local cookie="$1"
  local method="$2"
  local path="$3"
  local body="${4:-}"
  local output="$AUTHZ_TEST_DIR/last-response.json"

  if [[ -n "$body" ]]; then
    curl -sS -o "$output" -w '%{http_code}\n' \
      -b "$cookie" \
      -H 'Content-Type: application/json' \
      -X "$method" "$GRAFANA_URL$path" \
      -d "$body"
  else
    curl -sS -o "$output" -w '%{http_code}\n' \
      -b "$cookie" \
      -X "$method" "$GRAFANA_URL$path"
  fi
}
```

After every state restart, run:

```bash
USER_COOKIE="$AUTHZ_TEST_DIR/migration-user.cookie"

# Known legacy RBAC allow.
api_status "$USER_COOKIE" GET '/api/teams/search'

# Native action with no scope. Change the state in the name and email for each run.
api_status "$USER_COOKIE" POST '/api/teams' \
  '{"name":"Migration probe rbac","email":"probe-rbac@example.test"}'

# Native exact scope.
api_status "$USER_COOKIE" GET \
  '/api/dashboards/uid/migration-dashboard'

# Generic permission.
api_status "$USER_COOKIE" GET \
  "/api/plugins/$APP_PLUGIN_ID/settings"

# Native role list and mixed role detail.
api_status "$USER_COOKIE" GET \
  '/api/access-control/roles'
api_status "$USER_COOKIE" GET \
  '/api/access-control/roles/migration-k8s-grant'
```

Use a new team name and email in each state. A `409` means the name already exists; it does not tell you whether authorization passed.

### Expected results for the main user

`Allow` means `2xx`.

| Request                                  | `rbac` | `shadow` | `zanzana` |
| ---------------------------------------- | ------ | -------- | --------- |
| Team search, legacy control              | Allow  | Allow    | Allow     |
| Create team, native                      | Allow  | Allow    | Allow     |
| Read dashboard, native                   | Allow  | Allow    | Allow     |
| Read app plugin, generic                 | Allow  | Allow    | Allow     |
| List/read custom roles, native and mixed | Allow  | Allow    | Allow     |

How to read the table:

- **`rbac`:** RBAC controls the result. The current IAM storage path keeps the
  SQL compatibility mirror populated, so all grants remain usable.
- **`shadow`:** RBAC still controls the result. Zanzana checks the same request
  in the background and records whether the results match.
- **`zanzana`:** Zanzana controls the result. RBAC checks the same request in
  the background.

The migration changes the decision engine without changing user access.

### Negative checks

The user with no role must be denied in every state:

```bash
DENIED_COOKIE="$AUTHZ_TEST_DIR/migration-denied.cookie"

api_status "$DENIED_COOKIE" POST '/api/teams' \
  '{"name":"Denied probe","email":"denied-probe@example.test"}'
api_status "$DENIED_COOKIE" GET \
  '/api/dashboards/uid/migration-dashboard'
api_status "$DENIED_COOKIE" GET \
  "/api/plugins/$APP_PLUGIN_ID/settings"
api_status "$DENIED_COOKIE" GET \
  '/api/access-control/roles'
```

The Viewer must keep normal dashboard access in every state:

```bash
VIEWER_COOKIE="$AUTHZ_TEST_DIR/migration-viewer.cookie"

api_status "$VIEWER_COOKIE" GET \
  '/api/dashboards/uid/migration-dashboard'
```

Anonymous access is off, so this must return `401`:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  "$GRAFANA_URL/api/teams/search"
```

## 5. Check the local permission map

The local permission map is the action-to-scopes map attached to the signed-in identity. RBAC checks this map. Older UI checks and permission-inspection APIs also read it.

The map starts with basic roles and current SQL compatibility reads. With the
provided IAM storage mode, Kubernetes API writes remain available through that SQL
mirror. With Zanzana merge on, Grafana also adds native permissions listed by
Zanzana; that merge does not list generic permissions.

Read the map for the main user:

```bash
curl -sS -b "$AUTHZ_TEST_DIR/migration-user.cookie" \
  "$GRAFANA_URL/api/access-control/user/permissions" | jq
```

Expected result in all three states:

- the legacy `teams:read` control is present;
- native grants such as `teams:create`, `teams:write`, and the dashboard grant
  are present; and
- the generic plugin grant and both `roles:read` scopes are present.

The exact scope list may contain extra synthetic wildcards in `shadow` and
`zanzana`. The important check is that every source grant is represented.

## 6. Test the UI

Open a private browser window:

1. Go to `http://localhost:3000/login`.
2. Sign in with `migration-user` / `migration-password`.
3. Open developer tools and select the Network tab.
4. Reload after every Grafana restart. Sign in again if needed.

Check:

| UI area   | Where to open it                             | Permission type     |
| --------- | -------------------------------------------- | ------------------- |
| Team list | Administration → Users and access → Teams    | Legacy control      |
| New team  | **New team** on the Teams page               | Native, no scope    |
| Dashboard | `/d/migration-dashboard/migration-dashboard` | Native, exact scope |
| App page  | `/a/<app-plugin-id>`                         | Generic             |

For each item, record:

- whether the link or button is visible; and
- the HTTP status of the request in the Network tab.

Expected behavior:

- The dashboard, team list, new-team control, and app page work in all three
  states.
- The no-role user cannot open the dashboard or app and cannot see the app
  navigation.
- The Viewer keeps normal dashboard access.

Repeat the dashboard and team-create checks as `migration-denied`; they must fail. Repeat the dashboard check as `migration-viewer`; it must work.

This checkout has no standalone Roles page. Test native and mixed
`roles:read` behavior with the API requests in section 4.

## 7. Test the Kubernetes-style client

Run this request in all three states:

```bash
api_status "$AUTHZ_TEST_DIR/migration-user.cookie" GET \
  "/apis/dashboard.grafana.app/v1/namespaces/$GRAFANA_NAMESPACE/dashboards/migration-dashboard"
```

Expected behavior:

- all three states return `200`;
- `rbac` and `shadow` use the legacy client; and
- `zanzana` sets `zanzanaNoLegacyClient=true`, so the Kubernetes-style client
  uses Zanzana.

If `v1` is not served by this checkout, list the available versions:

```bash
curl -sS -u admin:admin \
  "$GRAFANA_URL/apis/dashboard.grafana.app" | jq
```

Use the version reported by discovery. Keep the same namespace and dashboard UID.

Direct IAM Role and RoleBinding resources require an access-policy identity. Use the redirected Enterprise APIs for normal fixture setup.

## 8. Test a service-account token

An ordinary service-account token identifies a persistent service account. It is not automatically a delegated permission limit. When Zanzana is primary, Grafana must still ask Zanzana about that service account.

Create a service account with no basic role:

```bash
SA_JSON="$(
  curl -sS -u admin:admin \
    -H 'Content-Type: application/json' \
    -X POST "$GRAFANA_URL/api/serviceaccounts" \
    -d '{
      "name":"migration-service-account",
      "isDisabled":false,
      "role":"None"
    }'
)"
export MIGRATION_SA_ID="$(jq -r '.id' <<<"$SA_JSON")"
```

Assign the Kubernetes-backed role:

```bash
curl -sS -u admin:admin \
  -H 'Content-Type: application/json' \
  -X POST \
  "$GRAFANA_URL/api/access-control/users/$MIGRATION_SA_ID/roles" \
  -d '{"roleUid":"migration-k8s-grant","global":false}' | jq
```

Create a one-hour token:

```bash
SA_TOKEN_JSON="$(
  curl -sS -u admin:admin \
    -H 'Content-Type: application/json' \
    -X POST \
    "$GRAFANA_URL/api/serviceaccounts/$MIGRATION_SA_ID/tokens" \
    -d '{"name":"migration-manual-test","secondsToLive":3600}'
)"
export MIGRATION_SA_TOKEN="$(jq -r '.key' <<<"$SA_TOKEN_JSON")"
```

Test one native and one generic permission:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $MIGRATION_SA_TOKEN" \
  "$GRAFANA_URL/api/dashboards/uid/migration-dashboard"

curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $MIGRATION_SA_TOKEN" \
  "$GRAFANA_URL/api/plugins/$APP_PLUGIN_ID/settings"
```

Expected behavior:

- all three states allow both grants because the provided IAM storage mode keeps
  the SQL compatibility mirror available;
- in `zanzana`, the ordinary token must still reach Zanzana instead of being
  denied early by the local map; and
- one isolated Zanzana-primary request should increase the Zanzana check and
  comparison counters.

The token expires after one hour.

## 9. Optional: test a delegated token limit

This test is different from the service-account token above. A delegated on-behalf-of token is an extra limit. Both Zanzana and the token must allow a permission.

Start the local auth signer after applying the Enterprise overlay:

```bash
make devenv sources="auth/signer"
```

Add this to the INI file for the state you are testing, then restart Grafana:

```ini
[auth.extended_jwt]
enabled = true
jwks_url = http://localhost:6481/jwks
```

In a disposable local signer config, create a service whose `delegatedPermissions` contains `teams:read` but not `teams:create`. Do not change a shared signer.

Mint a token for the main user:

```bash
curl -sS \
  -H 'Authorization: Bearer ThisIsMySecretToken' \
  -H 'Content-Type: application/json' \
  -X POST http://localhost:6481/sign/access-token \
  -d "{
    \"namespace\":\"$GRAFANA_NAMESPACE\",
    \"audiences\":[\"grafana\"],
    \"subject\":{
      \"identifier\":\"$PHASE_USER_UID\",
      \"type\":\"user\",
      \"namespace\":\"$GRAFANA_NAMESPACE\",
      \"username\":\"migration-user\",
      \"email\":\"migration-user@example.test\"
    }
  }" | jq
```

Save the returned token in `MIGRATION_OBO_TOKEN`, then run:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "X-Access-Token: $MIGRATION_OBO_TOKEN" \
  "$GRAFANA_URL/api/teams/search"

curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "X-Access-Token: $MIGRATION_OBO_TOKEN" \
  -H 'Content-Type: application/json' \
  -X POST "$GRAFANA_URL/api/teams" \
  -d '{"name":"Delegated denied probe","email":"delegated@example.test"}'
```

With Zanzana primary:

- team read should work when both Zanzana and the token allow it;
- team creation must fail because the token does not contain `teams:create`, even though the user has that grant in Zanzana.

A token with no persistent user or service-account subject is different. Its signed permission map is the authority, so Grafana should not treat it like a stored Zanzana identity.

## 10. Check metrics and logs

After each state, read the migration metrics:

```bash
curl -sS -u admin:admin "$GRAFANA_URL/metrics" \
  | rg '^grafana_accesscontrol_fallback_'
```

The metrics are:

- `grafana_accesscontrol_fallback_comparisons_total` for full-result comparisons;
- `grafana_accesscontrol_fallback_engine_duration_seconds` for engine latency; and
- `grafana_accesscontrol_fallback_checks_total` for Zanzana permission leaves.

Comparison results include:

- `match`;
- `zanzana_allow_rbac_deny`;
- `zanzana_deny_rbac_allow`;
- `zanzana_error`;
- `rbac_error`; and
- `shadow_timeout`.

Expected metrics:

| State     | What to expect                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| `rbac`    | No fallback checks or comparisons.                                                                               |
| `shadow`  | Comparisons increase and should be `match`; RBAC controls the response.                                          |
| `zanzana` | Comparisons increase and should be `match`; Zanzana controls the response. Kubernetes-style clients use Zanzana. |

The shadow runs after the main request. Wait a few seconds before reading metrics.

Set `TEST_STATE` to the active state, then read useful log lines:

```bash
export TEST_STATE=shadow

rg \
  'Reconciled namespace|zanzana_allow_rbac_deny|zanzana_deny_rbac_allow|shadow_timeout' \
  "$AUTHZ_TEST_DIR/logs/$TEST_STATE/grafana.log"
```

Every mismatch changes a metric. Mismatch logs are sampled, so a short test may not log every mismatch. Logs do not contain the subject or raw scope.

In MT mode, use namespace reconciliation logs and metrics. The old global success-time gauge can remain zero.

## 11. Test promotion and rollback

### Promote from RBAC to shadow

1. Run the full API and UI checks in `rbac`.
2. Restart in `shadow` without changing the data directory.
3. Wait for `stacks-11` to report `inSync=true`.
4. Confirm that the same native, generic, and mixed grants still work.
5. Confirm that comparison metrics increase and report matches.

### Promote from shadow to Zanzana

1. Restart in `zanzana`.
2. Wait for reconciliation.
3. Confirm that native, generic, and mixed grants still work.
4. Confirm that the Kubernetes-style dashboard request also works through Zanzana.
5. Confirm that the negative user remains denied.

### Roll back without recreating permission data

1. From `zanzana`, restart in `shadow`.
2. Confirm that native, generic, and mixed grants still work.
3. Restart in `rbac`.
4. Confirm that the grants still work through the current SQL compatibility mirror.
5. Restart in `zanzana` and wait for reconciliation.
6. Confirm that all Kubernetes grants work again without recreating the role or binding.

Promotion and rollback must change only routing and compatibility behavior. They must not delete Kubernetes rules or Zanzana tuples.

## 12. Troubleshooting

### Every request returns `401`

- Check that `/api/health` comes from the expected process.
- Log in again and recreate the cookie.
- Make sure the command passes the cookie with `-b`.
- Check whether a service-account token expired.

### Role APIs return `404` for admin

- Confirm the binary exposes the Enterprise role APIs.
- Check `license_path` in the active INI file.
- Check the role and role-binding feature toggles in the active INI file.

### Zanzana primary still denies

- Check `zanzana = true`.
- Check `zanzanaRBACFallbackChecks = true`.
- Check `primary_engine = zanzana` in `grafana-zanzana.ini`.
- Wait for `stacks-11` to report `inSync=true`.
- Check that the main user is still a member of the bound team.
- Look for `grafana_accesscontrol_fallback_checks_total{result="error"}` and related logs.

### Native merge changes nothing

- Check `zanzanaMergeUserPermissions = true`.
- With the provided IAM storage mode, the SQL compatibility mirror may already
  contain the same native grants. This is expected.
- Compare the scope lists and metrics instead of expecting an HTTP decision to
  change.

### The API allows but the UI hides the control

Confirm the API returns `2xx` and inspect
`/api/access-control/user/permissions`. Record the missing action or scope as a
compatibility-read issue. Do not weaken backend authorization to make the
button appear.

### Plugin request returns `404`

Choose an installed app plugin, update `APP_PLUGIN_ID`, recreate the custom role with the new scope, and wait for reconciliation.

### Metrics do not change

- Make sure the request uses the legacy `AccessControl.Evaluate` path. Kubernetes-style clients are separate.
- Check that fallback checks are on in the active INI file.
- Wait for the shadow.
- Make sure you scrape the same process and port that handled the request.

## 13. Save the test results

For each state, save:

- the INI file used for the state;
- the API result table;
- screenshots and Network results for the four UI areas;
- the local permission map;
- fallback metrics before and after the requests;
- the latest successful `stacks-11` reconciliation line; and
- any mismatch, timeout, or error logs.

Move to the next rollout phase only when:

- expected allows work;
- expected denies remain denied;
- service-account and delegated-token behavior is correct;
- rollback works; and
- there are no unexplained errors or shadow timeouts.
