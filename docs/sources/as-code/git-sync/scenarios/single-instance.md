---
title: Single instance Git Sync
menuTitle: Single instance
description: Synchronize a single Grafana instance with a Git repository
weight: 10
keywords:
  - git sync
  - deployment patterns
  - scenarios
  - single instance
labels:
  products:
    - enterprise
    - oss
    - cloud
canonical: https://grafana.com/docs/grafana/latest/as-code/git-sync/scenarios/single-instance/
aliases:
  - ../../observability-as-code/git-sync/scenarios/single-instance/
  - ../../observability-as-code/provision-resources/git-sync-deployment-scenarios/single-instance/
  - ../../provision-resources/git-sync-deployment-scenarios/single-instance/
---

# Single instance Git Sync

Use a single Grafana instance synchronized with a Git repository. This is the foundation for Git Sync and helps you understand bidirectional synchronization.

Before you begin, ensure you have the following:

- A Git repository hosted on a [compatible Git provider](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/usage-limits/#compatible-git-providers).
- A Grafana instance that meets the [Git Sync setup prerequisites](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-before/).

## Use it for

Use this scenario in the following situations:

- **Getting started**: You want to learn how Git Sync works before implementing complex scenarios.
- **Personal projects**: Individual developers manage their own dashboards.
- **Small teams**: You have one environment and no complex workflows.
- **Development environments**: You need quick prototyping and testing.

## Architecture

In this scenario, one Repository resource connects a single Grafana instance to one path on one branch:

```text
┌─────────────────────────────────────────────┐
│ GitHub Repository                           │
│ Repository: your-org/grafana-manifests      │
│ Branch: main                                │
│                                             │
│ grafana-manifests/                          │
│ └── grafana/                                │
│     ├── dashboard-1.json                    │
│     ├── dashboard-2.json                    │
│     └── dashboard-3.json                    │
└─────────────────────────────────────────────┘
                       ↕
             Git Sync (bidirectional)
                       ↕
         ┌─────────────────────────────┐
         │ Grafana Instance            │
         │                             │
         │ Repository Resource:        │
         │ - url: grafana-manifests    │
         │ - branch: main              │
         │ - path: grafana/            │
         │                             │
         │ Creates folder:             │
         │ "grafana-manifests"         │
         └─────────────────────────────┘
```

## Repository structure

The following examples show how the same dashboards appear in Git and in Grafana.

**In Git:**

```text
your-org/grafana-manifests
└── grafana/
    ├── dashboard-1.json
    ├── dashboard-2.json
    └── dashboard-3.json
```

**In Grafana Dashboards view:**

```text
Dashboards
└── 📁 grafana-manifests/
    ├── Dashboard 1
    ├── Dashboard 2
    └── Dashboard 3
```

- A folder titled `grafana-manifests` contains all synced dashboards. The folder takes its title from the Repository resource's **Display name**, or `spec.title` if you configure Git Sync as code. In the setup wizard, the display name defaults to the repository path, for example `your-org/grafana-manifests`. This example uses the shorter `grafana-manifests`.
- If you choose folderless sync instead, Grafana doesn't create this folder and places the dashboards at the top level of **Dashboards**. Refer to [Sync targets](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts/#sync-targets).
- Each JSON file becomes a dashboard, displayed in the folder with its title.
- Users browse dashboards organized under this folder structure.

## Configuration parameters

Configure your Grafana instance to synchronize with the following parameters:

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `grafana/`

## How it works

Git Sync keeps Grafana and Git synchronized in both directions:

1. **From Grafana to Git**: When users create or modify dashboards in Grafana, Git Sync commits changes to the `grafana/` directory on the `main` branch.
2. **From Git to Grafana**: When you add or modify dashboard JSON files in the `grafana/` directory, Git Sync pulls these changes into Grafana.

## Learn more

Refer to the following documents to learn more:

- [Git Sync key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts/)
- [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/)
- [Git Sync for development and production environments](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/scenarios/dev-prod/)
- [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/usage-limits/)
