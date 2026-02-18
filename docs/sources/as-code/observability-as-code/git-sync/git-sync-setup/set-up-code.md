---
description: Instructions for setting up Git Sync as code, so you can provision GitHub repositories for use with Grafana.
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
title: Set up Git Sync for GitHub as code
weight: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/git-sync-setup/
aliases:
  - ../../../observability-as-code/provision-resources/git-sync-setup/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
  - ../provision-resources/git-sync-setup/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
---

# Set up Git Sync as code

{{< admonition type="caution" >}}

Git Sync is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Documentation and support is available **based on the different tiers** but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

**Git Sync is under development.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) for more information. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

You can also configure Git Sync using `grafanactl`. Since Git Sync configuration is managed as code using Custom Resource Definitions (CRDs), you can create your required resources in YAML files and push them to Grafana using `grafanactl`. This approach enables automated, GitOps-style workflows for managing Git Sync configuration instead of using the Grafana UI.

For more information, refer to the following documents:

- [Repository resource](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts#git-sync-repository-resource) and [Connection resource](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts#git-sync-repository-resource) overview
- [Dashboard CRD Format](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/export-resources/)
- [`grafanactl` documentation](https://grafana.github.io/grafanactl/)

## Set up Git Sync for GitHub as code

To set up Git Sync with `grafanactl`, follow these steps:

1. Understand [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits)
1. [Create the connection and repository CRDs](#create-the-resources-crds)
1. [Push the CRDs to Grafana](#push-the-resources-to-grafana)
1. [Manage repository resources](#manage-repository-resources)
1. [Verify setup](#verify-setup)

## Create the resources CRDs

You need to create a repository resource and, if you're connecting to Git Sync with GitHub App, a connection resource as well.

### Create the connection resource

If you're connecting Git Sync with GitHub App, create a `connection.yaml` file defining your Git Sync connection configuration:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Connection
metadata:
  name: '<GITHUB_CONNECTION_NAME>'
  namespace: default
spec:
  title: <REPOSITORY_TITLE>
  type: github
  url: https://github.com
  github:
    appID: '<GITHUB_APP_ID>'
    installationID: '<GITHUB_INSTALL_ID>'
secure:
  privateKey:
    create: '<GITHUB_PRIVATE_KEY'
```

Replace the placeholders with your values:

- _`<GITHUB_CONNECTION_NAME>`_: The name of your GitHub connection
- _`<REPOSITORY_TITLE>`_: Human-readable name displayed in Grafana UI
- _`<GITHUB_APP_ID>`_: GitHub App unique identifier
- _`<GITHUB_INSTALL_ID>`_: GitHub App installation id
- _`<GITHUB_PRIVATE_KEY>`_: GitHub Private Key

### Create the repository resource

Next, create a `repository.yaml` file defining your Git Sync configuration. Depending on your authentication method, add your Personal Access Token information or the connection name.

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
  # GitHub App connection only:
  connection:
    name: <GITHUB_CONNECTION_NAME>
sync:
    enabled: true
    intervalSeconds: 60
    target: folder
  workflows:
    - write
    - branch
# Personal Access Token connection only:
secure:
  token:
    create: <GITHUB_PAT>
```

Replace the placeholders with your values:

- _`<REPOSITORY_NAME>`_: Unique identifier for this repository resource
- _`<REPOSITORY_TITLE>`_: Human-readable name displayed in Grafana UI
- _`<GITHUB_REPO_URL>`_: GitHub repository URL
- _`<BRANCH>`_: Branch to sync
- _`<GITHUB_CONNECTION_NAME>`_: The name of your GitHub connection
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

## Push the resources to Grafana

Before pushing any resources, configure `grafanactl` with your Grafana instance details. Refer to the [grafanactl configuration documentation](https://grafana.github.io/grafanactl/) for setup instructions.

Push the repository configuration. If you're using GitHub App to connect Git Sync, push the connection resource configuration file as well.

```sh
grafanactl resources push --path <DIRECTORY>
```

The `--path` parameter has to point to the directory containing your `repository.yaml` and `connection.yaml` files.

After pushing, Grafana will:

1. Create the required resources (repository and, for GitHub App, connection)
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
