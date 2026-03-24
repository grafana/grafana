# API Reference for Cleanup & Verification

All endpoints use basic auth `admin:admin` against `http://localhost:3000`.

## Repository Management

### List Repositories

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | jq
```

### Get Repository by Name

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/{name} | jq
```

### Delete Repository

```bash
curl -X DELETE -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/{name}
```

This removes the repository configuration. Dashboards/resources synced from it remain in Grafana unless you use the UI's "Delete and remove resources" option.

## Connection Management (GitHub App Flow)

### List Connections

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/connections | jq
```

### Get Connection by Name

```bash
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/connections/{name} | jq
```

### Delete Connection

```bash
curl -X DELETE -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/connections/{name}
```

Delete the connection only after deleting any repositories that reference it.

## Sync Jobs

### List Jobs for a Repository

```bash
curl -s -u admin:admin \
  "http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/{name}/jobs" | jq
```

### Get Job Status

```bash
curl -s -u admin:admin \
  "http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/{name}/jobs/{jobName}" | jq
```

## UI Cleanup Flow

If you prefer UI-based cleanup:

1. **Delete repository:** Navigate to `/admin/provisioning/{repoName}` -> Click the "Delete" dropdown button -> Select "Delete and remove resources" -> Confirm in the modal dialog
2. **Delete connection (GitHub App only):** Navigate to `/admin/provisioning?tab=connections` -> Find the connection in the list -> Click its Delete button -> Confirm

## Verification Checks

After wizard completion, verify the repository was created:

```bash
# Check repository exists and has expected config
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
  jq '.items[] | {name: .metadata.name, type: .spec.type, url: .spec.github.url}'
```

After cleanup, verify deletion:

```bash
# Should return empty items list or 404 for specific resource
curl -s -u admin:admin \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories | \
  jq '.items | length'
```

## Full Cleanup Script

```bash
#!/bin/bash
# Delete all test repositories and connections
BASE="http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default"
AUTH="admin:admin"

# Delete repositories first
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
