# Folder default permissions backfill

One-off script for incident **i-2026-07-09-mt-folder-service-cannot-create-default-permissions**.

Affected stacks are listed in `incident-2026-07-09-affected-instances.tsv` (290 stacks / 508 repos across 28 prod clusters). The script **does not** trust the TSV repo column — it discovers repositories and root folders live from the Provisioning API, per [backfill.md](./backfill.md).

## What it does

For each `(stack_id, cluster)` row:

1. `kubectl` context → target cluster
2. Port-forward **auth** (`api-lb`), **provisioning** (`provisioning-grafana-app-main`), and **IAM** (`iam-grafana-app-main`)
3. Exchange CAP tokens:
   - `provisioning-connection-operator-system-cap` → Provisioning API
   - `folder-grafana-app-main-system-cap` → IAM ResourcePermission API
4. List repositories, resolve root folders (`folder` vs `folderless` sync modes)
5. `GET` `iam.grafana.app/v0alpha1/.../resourcepermissions/folder.grafana.app-folders-{uid}`
6. On **404**, `POST` default permissions (Editor `edit`, Viewer `view`) — matching `pkg/registry/apis/folders/register.go`

## Safety

- **Dry-run is the default.** No writes unless you pass `--execute`.
- Review output before running against prod.
- Requires appropriate kubectl access to prod clusters and CAP secrets.

## Prerequisites

- `kubectl` contexts named like the TSV `cluster` column (e.g. `prod-us-east-0`), or set `KUBE_CONTEXT_PREFIX`
- `curl`, `jq`
- `gcom` (recommended) for org ID resolution during token exchange

## Usage

```bash
# Dry-run a single stack (recommended first step)
./scripts/backfill-folder-default-permissions/backfill-folder-permissions.sh \
  --tsv ~/Downloads/incident-2026-07-09-affected-instances.tsv \
  --cluster prod-us-east-0 \
  --stack stacks-1066436 \
  --verbose

# Dry-run first N stacks in one cluster
./scripts/backfill-folder-default-permissions/backfill-folder-permissions.sh \
  --tsv ~/Downloads/incident-2026-07-09-affected-instances.tsv \
  --cluster prod-us-east-0 \
  --limit 3

# Execute after review (creates missing permissions only)
./scripts/backfill-folder-default-permissions/backfill-folder-permissions.sh \
  --tsv ~/Downloads/incident-2026-07-09-affected-instances.tsv \
  --cluster prod-us-east-0 \
  --stack stacks-1066436 \
  --execute
```

## Configuration (environment)

| Variable                  | Default   | Purpose                                                                                                                                          |
| ------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PROVISIONING_CAP_SECRET` | _(auto)_  | Provisioning operator CAP (grafana-apps). Prod: `provisioning-connection-operator-{cluster}`; dev: `provisioning-connection-operator-system-cap` |
| `FOLDER_CAP_SECRET`       | _(auto)_  | Folder app CAP (grafana-folder). Prod: `folder-grafana-app-main-{cluster}`; dev: `folder-grafana-app-main-system-cap`                            |
| `GCOM_CMD`                | `gcom`    | Resolve org ID for token exchange                                                                                                                |
| `KUBE_CONTEXT_PREFIX`     | _(empty)_ | Prefix for kubectl `--context`                                                                                                                   |
| `AUTH_LOCAL_PORT`         | `18080`   | Local auth API port-forward                                                                                                                      |
| `PROVISIONING_LOCAL_PORT` | `16443`   | Local provisioning API port-forward                                                                                                              |
| `IAM_LOCAL_PORT`          | `16444`   | Local IAM API port-forward                                                                                                                       |

## Permission object

- **Name:** `folder.grafana.app-folders-{folderUID}`
- **Namespace:** stack namespace from TSV (e.g. `stacks-1005291`)
- **Spec:** Editor + Viewer basic roles only (no creator admin — folders were created by the provisioning operator identity)

## References

- Spec: [backfill.md](./backfill.md)
- Default permissions source: `pkg/registry/apis/folders/register.go` (`defaultPermissions`)
- Token exchange pattern: `deployment_tools/scripts/iam/iam-api.sh`
- Provisioning port-forward pattern: `deployment_tools/docs/grafana-app-platform/runbooks.md`
