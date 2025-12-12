---
title: Git Sync deployment scenarios
menuTitle: Deployment scenarios
description: Learn about common Git Sync deployment patterns and configurations for different organizational needs
weight: 450
keywords:
  - git sync
  - deployment patterns
  - scenarios
  - multi-environment
  - teams
---

# Git Sync deployment scenarios

This guide shows practical deployment scenarios for Grafana’s Git Sync. Learn how to configure bidirectional synchronization between Grafana and Git repositories for teams, environments, and regions.

{{< admonition type="caution" >}}
Git Sync is an experimental feature. It reflects Grafana’s approach to Observability as Code and might include limitations or breaking changes. For current status and known limitations, refer to the [Git Sync introduction](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/intro-git-sync/).
{{< /admonition >}}

## Understand the relationship between key Git Sync components

Before you explore the scenarios, understand how the key Git Sync components relate:

- [Grafana instance](#grafana-instance)
- [Git repository structure](#git-repository-structure)
- [Git Sync repository resource](#git-sync-repository-resource)

### Grafana instance

A Grafana instance is a running Grafana server. Multiple instances can:

- Connect to the same Git repository using different Repository configurations.
- Sync from different branches of the same repository.
- Sync from different paths within the same repository.
- Sync from different repositories.

### Git repository structure

You can organize your Git repository in several ways:

- Single branch, multiple paths: Use different directories for different purposes (for example, `dev/`, `prod/`, `team-a/`).
- Multiple branches: Use different branches for different environments or teams (for example, `main`, `develop`, `team-a`).
- Multiple repositories: Use separate repositories for different teams or environments.

### Git Sync repository resource

A repository resource is a Grafana configuration object that defines:

- Which Git repository to sync with.
- Which branch to use.
- Which directory path to synchronize.
- Sync behavior and workflows.

Each repository resource creates bidirectional synchronization between a Grafana instance and a specific location in Git.

### How does repository sync behave?

With Git Sync you configure a repository resource to sync with your Grafana instance:

1. Grafana monitors the specified Git location (repository, branch, and path).
2. Grafana creates a folder in Dashboards (typically named after the repository).
3. Grafana creates dashboards from dashboard JSON files in Git within this folder.
4. Grafana commits dashboard changes made in the UI back to Git.
5. Grafana pulls dashboard changes made in Git and updates dashboards in the UI.
6. Synchronization occurs at regular intervals (configurable), or instantly if you use webhooks.

You can find the provisioned dashboards organized in folders under **Dashboards**.

### Example: Relationship between repository, branch, and path

Here's a concrete example showing how the three parameters work together:

**Configuration:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `team-platform/grafana/`

**In Git (on branch `main`):**

```
your-org/grafana-manifests/
├── .git/
├── README.md
├── team-platform/
│   └── grafana/
│       ├── cpu-metrics.json       ← Synced
│       ├── memory-usage.json      ← Synced
│       └── disk-io.json           ← Synced
├── team-data/
│   └── grafana/
│       └── pipeline-stats.json    ← Not synced (different path)
└── other-files.txt                 ← Not synced (outside path)
```

**In Grafana Dashboards view:**

```
Dashboards
└── 📁 grafana-manifests/
    ├── CPU Metrics Dashboard
    ├── Memory Usage Dashboard
    └── Disk I/O Dashboard
```

**Key points:**

- Grafana only synchronizes files within the specified path (`team-platform/grafana/`).
- Grafana ignores files in other paths or at the repository root.
- The folder name in Grafana comes from the repository name.
- Dashboard titles come from the JSON file content, not the filename.

## Repository configuration flexibility

Git Sync repositories support different combinations of repository URL, branch, and path:

- Different Git repositories: Each environment or team can use its own repository.
  - Instance A: `repository: your-org/grafana-prod`.
  - Instance B: `repository: your-org/grafana-dev`.
- Different branches: Use separate branches within the same repository.
  - Instance A: `repository: your-org/grafana-manifests, branch: main`.
  - Instance B: `repository: your-org/grafana-manifests, branch: develop`.
- Different paths: Use different directory paths within the same repository.
  - Instance A: `repository: your-org/grafana-manifests, branch: main, path: production/`.
  - Instance B: `repository: your-org/grafana-manifests, branch: main, path: development/`.
- Any combination: Mix and match based on your workflow requirements.

## Scenarios

Use these deployment scenarios to plan your Git Sync setup:

- [Single instance](/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/scenarios/single-instance/)
- [Development and production](/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/scenarios/dev-prod/)
- [Multi-region](/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/scenarios/multi-region/)
- [Primary–replica high availability](/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/scenarios/primary-replica/)
- [Active–active high availability](/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/scenarios/active-active/)
- [Multi-team](/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/scenarios/multi-team/)

## Learn more

Refer to the following documents to learn more:

- [Git Sync introduction](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/intro-git-sync/)
- [Git Sync setup guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/git-sync-setup/)
- [Dashboard provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/)
- [Observability as Code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/)

