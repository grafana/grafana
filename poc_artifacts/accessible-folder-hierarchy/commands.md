# POC command log

Credentials are intentionally omitted. The commands below use `POC_PASSWORD` supplied in the shell.

```bash
export POC_BASE_URL=http://127.0.0.1:3100
export POC_PASSWORD='<redacted>'

GF_PATHS_DATA=<fresh-temp-dir>/data \
GF_PATHS_LOGS=<fresh-temp-dir>/logs \
GF_PATHS_PLUGINS=<fresh-temp-dir>/plugins \
GF_DATABASE_TYPE=sqlite3 \
GF_DATABASE_PATH=<fresh-temp-dir>/grafana.db \
GF_SERVER_HTTP_PORT=3100 \
GF_SECURITY_ADMIN_PASSWORD="$POC_PASSWORD" \
GF_FEATURE_TOGGLES_ENABLE=foldersAppPlatformAPI,accessibleFolderHierarchy \
GOCACHE=/private/tmp/codex-go-cache \
make run

yarn start

curl -fsS "$POC_BASE_URL/api/health"
curl -fsS -u "admin:$POC_PASSWORD" "$POC_BASE_URL/api/frontend/settings"

# Repeated for teama, teamb, and teamc.
curl -fsS -u "admin:$POC_PASSWORD" -H 'Content-Type: application/json' \
  -X POST "$POC_BASE_URL/api/admin/users" -d '<user JSON>'
curl -fsS -u "admin:$POC_PASSWORD" -H 'Content-Type: application/json' \
  -X PATCH "$POC_BASE_URL/api/org/users/<id>" -d '{"role":"None"}'
curl -fsS -u "admin:$POC_PASSWORD" -H 'Content-Type: application/json' \
  -X POST "$POC_BASE_URL/api/teams" -d '<team JSON>'
curl -fsS -u "admin:$POC_PASSWORD" -H 'Content-Type: application/json' \
  -X POST "$POC_BASE_URL/api/teams/<team-id>/members" -d '<membership JSON>'

# Repeated for all 12 folders, with parentUid where applicable.
curl -fsS -u "admin:$POC_PASSWORD" -H 'Content-Type: application/json' \
  -X POST "$POC_BASE_URL/api/folders" -d '<folder JSON>'

# Repeated for team-a, team-b, and team-c. Edit is required for a selectable save destination.
curl -fsS -u "admin:$POC_PASSWORD" -H 'Content-Type: application/json' \
  -X POST "$POC_BASE_URL/api/folders/<leaf>/permissions" \
  -d '<single-team Edit grant JSON>'

# Repeated for each user.
curl -fsS -u "<user>:$POC_PASSWORD" \
  "$POC_BASE_URL/apis/folder.grafana.app/v1/namespaces/default/folders/general/tree?permission=view"
curl -sS -u "<user>:$POC_PASSWORD" -o /dev/null -w '%{http_code}' \
  "$POC_BASE_URL/apis/folder.grafana.app/v1/namespaces/default/folders/<uid>"

agent-browser --session <user> open "$POC_BASE_URL/login"
agent-browser --session <user> set viewport 1440 1000
agent-browser --session <user> open "$POC_BASE_URL/dashboards"
agent-browser --session <user> screenshot <browse-output.png>
agent-browser --session <user> open "$POC_BASE_URL/dashboard/new"
agent-browser --session <user> screenshot <picker-output.png>
agent-browser --session teamc a11y --tags wcag2a,wcag2aa --json

agent-browser --session demo record start \
  poc_artifacts/accessible-folder-hierarchy/accessible-folder-hierarchy-demo.mp4 --fps 20
# Expanded restricted / department-a, opened the dashboard save picker,
# expanded the same hierarchy, and selected team-a.
agent-browser --session demo record stop

yarn jest --no-watch --runInBand \
  public/app/features/folders/api/accessibleFolderTree.test.ts \
  public/app/core/components/NestedFolderPicker/useFoldersQueryAccessible.test.tsx \
  public/app/core/components/NestedFolderPicker/NestedFolderPicker.test.tsx \
  public/app/core/components/NestedFolderPicker/useFoldersQuery.test.ts \
  public/app/features/browse-dashboards/api/services.test.ts \
  public/app/features/browse-dashboards/components/CheckboxCell.test.tsx \
  public/app/features/search/service/unified.test.ts

yarn tsc --noEmit

GOCACHE=/private/tmp/codex-go-cache go test ./pkg/registry/apis/folders \
  -run 'TestBuildFolderTree|TestTreePermission' -count=1
GOCACHE=/private/tmp/codex-go-cache go test ./pkg/tests/apis/folder \
  -run '^TestIntegrationFolderTree$' -count=1
```
