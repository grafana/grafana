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
  jq '.items[] | {name: .metadata.name, type: .spec.type, url: (.spec.github.url // .spec.gitlab.url // .spec.bitbucket.url // .spec.git.url)}'
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
# Delete all test repositories and GitHub App connections
BASE="http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default"
AUTH="admin:admin"

# Delete repositories first
for name in $(curl -s -u "$AUTH" "$BASE/repositories" | jq -r '.items[].metadata.name'); do
  echo "Deleting repository: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/repositories/$name"
done

# Then delete connections (GitHub App only)
for name in $(curl -s -u "$AUTH" "$BASE/connections" | jq -r '.items[].metadata.name // empty'); do
  echo "Deleting connection: $name"
  curl -s -X DELETE -u "$AUTH" "$BASE/connections/$name"
done

echo "Cleanup complete."
```

## Create Repository via API

Use the provider-specific payload that matches your repository type. All examples create a folder-scoped repo on `agent-test` with both `write` and `branch` workflows enabled.

### Provider Mapping

| Provider        | `spec.type` | Config block | Repo URL env var                   | Token env var                   | Extra field                                        |
| --------------- | ----------- | ------------ | ---------------------------------- | ------------------------------- | -------------------------------------------------- |
| GitHub PAT      | `github`    | `github`     | `GIT_SYNC_TEST_PAT_REPO_URL`       | `GIT_SYNC_TEST_PAT`             | `generateDashboardPreviews` optional               |
| GitLab token    | `gitlab`    | `gitlab`     | `GIT_SYNC_TEST_GITLAB_REPO_URL`    | `GIT_SYNC_TEST_GITLAB_TOKEN`    | none                                               |
| Bitbucket token | `bitbucket` | `bitbucket`  | `GIT_SYNC_TEST_BITBUCKET_REPO_URL` | `GIT_SYNC_TEST_BITBUCKET_TOKEN` | `tokenUser: "$GIT_SYNC_TEST_BITBUCKET_TOKEN_USER"` |

### Create GitHub PAT Repository

```bash
curl -s -X POST -u admin:admin \
  -H 'Content-Type: application/json' \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories \
  -d '{
  "apiVersion": "provisioning.grafana.app/v0alpha1",
  "kind": "Repository",
  "metadata": {
    "name": "REPO_NAME"
  },
  "spec": {
    "title": "REPO_TITLE",
    "description": "API-created repo for testing",
    "type": "github",
    "github": {
      "url": "$GIT_SYNC_TEST_PAT_REPO_URL",
      "branch": "agent-test",
      "generateDashboardPreviews": false,
      "path": "PATH"
    },
    "sync": {
      "enabled": true,
      "target": "folder",
      "intervalSeconds": 60
    },
    "workflows": ["write", "branch"]
  },
  "secure": {
    "token": { "create": "$GIT_SYNC_TEST_PAT" }
  }
}'
```

### Create GitLab Token Repository

```bash
curl -s -X POST -u admin:admin \
  -H 'Content-Type: application/json' \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories \
  -d '{
  "apiVersion": "provisioning.grafana.app/v0alpha1",
  "kind": "Repository",
  "metadata": {
    "name": "REPO_NAME"
  },
  "spec": {
    "title": "REPO_TITLE",
    "description": "API-created repo for testing",
    "type": "gitlab",
    "gitlab": {
      "url": "$GIT_SYNC_TEST_GITLAB_REPO_URL",
      "branch": "agent-test",
      "path": "PATH"
    },
    "sync": {
      "enabled": true,
      "target": "folder",
      "intervalSeconds": 60
    },
    "workflows": ["write", "branch"]
  },
  "secure": {
    "token": { "create": "$GIT_SYNC_TEST_GITLAB_TOKEN" }
  }
}'
```

### Create Bitbucket Token Repository

```bash
curl -s -X POST -u admin:admin \
  -H 'Content-Type: application/json' \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories \
  -d '{
  "apiVersion": "provisioning.grafana.app/v0alpha1",
  "kind": "Repository",
  "metadata": {
    "name": "REPO_NAME"
  },
  "spec": {
    "title": "REPO_TITLE",
    "description": "API-created repo for testing",
    "type": "bitbucket",
    "bitbucket": {
      "url": "$GIT_SYNC_TEST_BITBUCKET_REPO_URL",
      "branch": "agent-test",
      "path": "PATH",
      "tokenUser": "$GIT_SYNC_TEST_BITBUCKET_TOKEN_USER"
    },
    "sync": {
      "enabled": true,
      "target": "folder",
      "intervalSeconds": 60
    },
    "workflows": ["write", "branch"]
  },
  "secure": {
    "token": { "create": "$GIT_SYNC_TEST_BITBUCKET_TOKEN" }
  }
}'
```

Replace `REPO_NAME`, `REPO_TITLE`, and `PATH` with your values. Use the env vars shown in the example for your provider.

### Create Sync Job

After creating a repository, trigger an initial sync:

```bash
curl -s -X POST -u admin:admin \
  -H 'Content-Type: application/json' \
  http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/{name}/jobs \
  -d '{"action":"pull","pull":{}}'
```

Poll job status until `state` is `success` or `error`:

```bash
curl -s -u admin:admin \
  "http://localhost:3000/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/{name}/jobs/{jobName}" | \
  jq '.status.state'
```

## User Management

### Create User

```bash
curl -s -X POST -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/admin/users \
  -d '{"login":"USERNAME","password":"PASSWORD","email":"EMAIL","name":"DISPLAY_NAME"}'
# Returns: {"id": N, ...}
```

### Set Org Role

New users default to Admin — downgrade to Viewer or Editor:

```bash
curl -s -X PATCH -u admin:admin -H 'Content-Type: application/json' \
  http://localhost:3000/api/org/users/{userId} \
  -d '{"role":"Viewer"}'
```

Valid roles: `Viewer`, `Editor`, `Admin`.

### Delete User

```bash
curl -X DELETE -u admin:admin http://localhost:3000/api/admin/users/{userId}
```
