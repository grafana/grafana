---
title: Provision Git Sync repositories from files
weight: 40
---

# Provision Git Sync repositories from files

This change adds the file-provisioning format for Git Sync `Repository` and `Connection` resources. It uses the same `provisioning.grafana.app/v0alpha1` resources used by Grafana's as-code API and `gcx`, so the file format is not a separate configuration model.

Once startup integration is enabled, place YAML files in:

```text
<provisioning-path>/repositories/
```

The directory is scanned for `.yaml` and `.yml` files. A file may contain multiple YAML documents.

## Repository example

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: dashboards
spec:
  title: Dashboards
  type: git
  git:
    url: https://git.example.com/observability/dashboards.git
    branch: main
    tokenUser: grafana
  sync:
    enabled: true
    intervalSeconds: 60
    target: folder
secure:
  token:
    create: ${GIT_ACCESS_TOKEN}
```

## Connection example

Connections are useful for provider-specific authentication such as GitHub Apps:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Connection
metadata:
  name: github-app
spec:
  title: GitHub App
  type: github
  url: https://github.com
  github:
    appID: ${GITHUB_APP_ID}
    installationID: ${GITHUB_INSTALLATION_ID}
secure:
  privateKey:
    create: ${GITHUB_PRIVATE_KEY}
```

Repository and connection objects are created or updated through the provisioning API. Existing secure values are therefore handled by the same admission and secret-storage path as resources created through the UI or API.

Environment variables use Grafana's standard `$VAR` or `${VAR}` syntax. Missing variables expand to an empty value and are subsequently rejected when the resource validation requires the field.

File provisioning is intended for GitOps and immutable infrastructure deployments. For interactive management, use the Git Sync UI or the API. For repositories already represented as YAML in a GitOps repository, `gcx resources push` remains supported.
