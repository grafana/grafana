---
description: Instructions for setting up Git Sync, so you can provision GitHub repositories for use with Grafana.
keywords:
  - set up
  - git integration
  - git sync
  - github
  - as code
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Set up Git Sync as code
weight: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/
aliases:
  - ../../../observability-as-code/provision-resources/git-sync-setup/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
  - ../provision-resources/git-sync-setup/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
---

# Set up Git Sync as code

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

Git Sync is under continuous development. [Report any issues](https://grafana.com/help/) you encounter to help us improve Git Sync.

{{< /admonition >}}

You can also configure Git Sync using `grafanactl`. Since Git Sync configuration is managed as code using Custom Resource Definitions (CRDs), you can create a Repository CRD in a YAML file and use `grafanactl` to push it to Grafana. This approach enables automated, GitOps-style workflows for managing Git Sync configuration instead of using the Grafana UI.

To set up Git Sync with `grafanactl`, follow these steps:

1. [Create the repository CRD](#create-the-repository-crd)
1. [Push the repository CRD to Grafana](#push-the-repository-crd-to-grafana)
1. [Manage repository resources](#manage-repository-resources)
1. [Verify setup](#verify-setup)

For more information, refer to the following documents:

- [grafanactl Documentation](https://grafana.github.io/grafanactl/)
- [Repository CRD Reference](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/git-sync-setup/)
- [Dashboard CRD Format](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/export-resources/)

## Create the repository CRD

Create a `repository.yaml` file defining your Git Sync configuration:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: <REPOSITORY_NAME>
spec:
  title: <REPOSITORY_TITLE>
  type: github
  github:
    url: <GITHUB_REPO_URL>
    branch: <BRANCH>
    path: grafana/
    generateDashboardPreviews: true
  sync:
    enabled: true
    intervalSeconds: 60
    target: folder
  workflows:
    - write
    - branch
secure:
  token:
    create: <GITHUB_PAT>
```

Replace the placeholders with your values:

- _`<REPOSITORY_NAME>`_: Unique identifier for this repository resource
- _`<REPOSITORY_TITLE>`_: Human-readable name displayed in Grafana UI
- _`<GITHUB_REPO_URL>`_: GitHub repository URL
- _`<BRANCH>`_: Branch to sync
- _`<GITHUB_PAT>`_: GitHub Personal Access Token

{{< admonition type="note" >}}

Only `target: folder` is currently supported for Git Sync.

{{< /admonition >}}

### Configuration parameters

The following configuration parameters are available:

| Field                                   | Description                                                 |
| --------------------------------------- | ----------------------------------------------------------- |
| `metadata.name`                         | Unique identifier for this repository resource              |
| `spec.title`                            | Human-readable name displayed in Grafana UI                 |
| `spec.type`                             | Repository type (`github`)                                  |
| `spec.github.url`                       | GitHub repository URL                                       |
| `spec.github.branch`                    | Branch to sync                                              |
| `spec.github.path`                      | Directory path containing dashboards                        |
| `spec.github.generateDashboardPreviews` | Generate preview images (true/false)                        |
| `spec.sync.enabled`                     | Enable synchronization (true/false)                         |
| `spec.sync.intervalSeconds`             | Sync interval in seconds                                    |
| `spec.sync.target`                      | Where to place synced dashboards (`folder`)                 |
| `spec.workflows`                        | Enabled workflows: `write` (direct commits), `branch` (PRs) |
| `secure.token.create`                   | GitHub Personal Access Token                                |

## Push the repository CRD to Grafana

Before pushing any resources, configure `grafanactl` with your Grafana instance details. Refer to the [grafanactl configuration documentation](https://grafana.github.io/grafanactl/) for setup instructions.

Push the repository configuration:

```sh
grafanactl resources push --path <DIRECTORY>
```

The `--path` parameter has to point to the directory containing your `repository.yaml` file.

After pushing, Grafana will:

1. Create the repository resource
1. Connect to your GitHub repository
1. Pull dashboards from the specified path
1. Begin syncing at the configured interval

## Manage repository resources

### List repositories

To list all repositories:

```sh
grafanactl resources get repositories
```

### Get repository details

To get details for a specific repository:

```sh
grafanactl resources get repository/<REPOSITORY_NAME>
grafanactl resources get repository/<REPOSITORY_NAME> -o json
grafanactl resources get repository/<REPOSITORY_NAME> -o yaml
```

### Update the repository

To update a repository:

```sh
grafanactl resources edit repository/<REPOSITORY_NAME>
```

### Delete the repository

To delete a repository:

```sh
grafanactl resources delete repository/<REPOSITORY_NAME>
```

## Verify setup

Check that Git Sync is working:

```sh
# List repositories
grafanactl resources get repositories

# Check Grafana UI
# Navigate to: Administration → Provisioning → Git Sync
```

