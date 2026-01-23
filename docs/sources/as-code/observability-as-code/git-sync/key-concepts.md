---
description: Key concepts to understand how Git Sync works.
keywords:
  - as code
  - as-code
  - dashboards
  - git integration
  - git sync
  - github
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Git Sync Key concepts
menuTitle: Key concepts
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/key-concepts/
aliases:
---

# Git Sync key concepts

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions.

Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

{{< /admonition >}}

## Key Git Sync components

Before you start using Git Sync, understand how the key Git Sync components relate:

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

## Flexible configuration for your repositories

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

## How does Git Sync behave?

Git Sync is bidirectional, and syncs a repository resource with your Grafana instance. You can modify provisioned resources both from the Grafana UI or from the synced GitHub repository, and changes will be reflected in both places:

1. Grafana monitors the specified Git location (repository, branch, and path).
2. Grafana creates a folder in Dashboards (typically named after the repository).
3. Grafana creates dashboards from dashboard JSON files in Git within this folder.
4. Grafana commits dashboard changes made in the UI back to Git.
5. Grafana pulls dashboard changes made in Git and updates dashboards in the UI.
6. Synchronization occurs at regular intervals (configurable), or instantly if you use webhooks.

You can find the provisioned dashboards organized in folders under **Dashboards**.

## Example: Relationship between repository, branch, and path

Here's an example showing how the three concepts work together:

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
└── other-files.txt                ← Not synced (outside path)
```

**In the Grafana Dashboards view:**

```
Dashboards
└── 📁 grafana-manifests/
    ├── CPU Metrics Dashboard
    ├── Memory Usage Dashboard
    └── Disk I/O Dashboard
```

**Key takeaways:**

- Grafana only synchronizes files within the specified path (`team-platform/grafana/`).
- Grafana ignores files in other paths or at the repository root.
- The folder name in Grafana comes from the repository name.
- Dashboard titles come from the JSON file content, not the filename.


