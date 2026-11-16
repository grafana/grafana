---
title: Git Sync in a Grafana instance shared by multiple teams
menuTitle: Shared instance
description: Use multiple Git repositories with one Grafana instance, one repository per team
weight: 60
keywords:
  - git sync
  - deployment patterns
  - scenarios
  - teams
  - shared instance
labels:
  products:
    - enterprise
    - oss
    - cloud
canonical: https://grafana.com/docs/grafana/latest/as-code/git-sync/scenarios/multi-team/
aliases:
  - ../../observability-as-code/git-sync/scenarios/multi-team/
  - ../../observability-as-code/provision-resources/git-sync-deployment-scenarios/multi-team/
  - ../../provision-resources/git-sync-deployment-scenarios/multi-team/
---

# Git Sync in a Grafana instance shared by multiple teams

Use a single Grafana instance with multiple Repository resources, one per team. Each team manages its own dashboards while sharing Grafana.

Before you begin, ensure you have the following:

- One Git repository per team, hosted on a [compatible Git provider](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/usage-limits/#compatible-git-providers).
- A Grafana instance that meets the [Git Sync setup prerequisites](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-before/).

## Use it for

Use this scenario in the following situations:

- **Team autonomy**: Different teams manage their own dashboards independently.
- **Organizational structure**: Dashboard organization aligns with team structure.
- **Resource efficiency**: Multiple teams share Grafana infrastructure.
- **Cost optimization**: You reduce infrastructure costs while maintaining team separation.
- **Collaboration**: Teams can view each other's dashboards while managing their own.

## Architecture

In this scenario, each team's repository syncs into its own folder in the same Grafana instance:

```text
┌─────────────────────────┐      ┌─────────────────────────┐
│ Platform Team Repo      │      │ Data Team Repo          │
│ platform-dashboards     │      │ data-dashboards         │
│                         │      │                         │
│ platform-dashboards/    │      │ data-dashboards/        │
│ └── grafana/            │      │ └── grafana/            │
│     ├── k8s.json        │      │     ├── pipeline.json   │
│     └── infra.json      │      │     └── analytics.json  │
└─────────────────────────┘      └─────────────────────────┘
             ↕                                ↕
      Git Sync (grafana/)              Git Sync (grafana/)
             ↕                                ↕
      ┌───────────────────────────────────────────────┐
      │ Grafana Instance                              │
      │                                               │
      │ Repository 1:                                 │
      │ - repo: platform-dashboards                   │
      │ → Creates "platform-dashboards"               │
      │                                               │
      │ Repository 2:                                 │
      │ - repo: data-dashboards                       │
      │ → Creates "data-dashboards"                   │
      └───────────────────────────────────────────────┘
```

## Repository structure

The following examples show how each team's repository appears in Git and how both appear in Grafana.

**In Git (separate repositories):**

**Platform team repository:**

```text
your-org/platform-dashboards
└── grafana/
    ├── dashboard-k8s.json
    └── dashboard-infra.json
```

**Data team repository:**

```text
your-org/data-dashboards
└── grafana/
    ├── dashboard-pipeline.json
    └── dashboard-analytics.json
```

**In Grafana Dashboards view:**

```text
Dashboards
├── 📁 platform-dashboards/
│   ├── Kubernetes Dashboard
│   └── Infrastructure Dashboard
└── 📁 data-dashboards/
    ├── Pipeline Dashboard
    └── Analytics Dashboard
```

- Grafana creates two separate folders, one per Repository resource.
- Grafana titles each folder with its Repository resource's display name.
- Each team has complete control over its own repository.
- Teams can independently manage permissions, branches, and workflows in their repositories.
- By default, every user with the `Editor` role can edit dashboards in every team's folder, because Git Sync copies organization roles into each provisioned folder. To limit each team to its own folder, set folder-level permissions. Permissions in your Git repositories don't apply to edits made in Grafana. Refer to [Configure folder and dashboard permissions](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/permissions-grafana/#configure-folder-and-dashboard-permissions).

## Configuration parameters

Configure one Repository resource per team with the following parameters.

**Platform team repository:**

- **Repository**: `your-org/platform-dashboards`
- **Branch**: `main`
- **Path**: `grafana/`

**Data team repository:**

- **Repository**: `your-org/data-dashboards`
- **Branch**: `main`
- **Path**: `grafana/`

## How it works

Each team works in its own repository, and Grafana shows them side by side:

1. Each team has its own Git repository for complete autonomy.
2. Each Repository resource in Grafana creates a separate folder.
3. Platform team dashboards sync from the `your-org/platform-dashboards` repository.
4. Data team dashboards sync from the `your-org/data-dashboards` repository.
5. Teams can independently manage their repository settings, access controls, and workflows.
6. With folder-level permissions set, all teams can view each other's dashboards in Grafana but edit only their own.

## Scale to more teams

To add a team, create a repository and configure another Repository resource:

- **Repository**: `your-org/security-dashboards`
- **Branch**: `main`
- **Path**: `grafana/`

This creates a `security-dashboards` folder in the same Grafana instance.

Each Repository resource counts toward your repository connection limit: 1 on Grafana Cloud Free, 10 on other Grafana Cloud tiers, and 10 by default on self-managed Grafana, where you can change it with `max_repositories`. The alternatives on this page also use one connection per team. One connection per team works for a few teams, but it doesn't scale as you add more.

For more than a few teams, shard by capacity instead. Keep all teams in one repository, group them into shard folders of up to about 1,000 resources each, and connect each shard folder separately. Refer to [Shard by capacity, not by team](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/usage-limits/#shard-by-capacity-not-by-team).

## Alternative: Shared repository with different paths

For teams that prefer sharing a single repository, use different paths to separate team dashboards.

**In Git:**

```text
your-org/grafana-manifests
├── team-platform/
│   ├── dashboard-k8s.json
│   └── dashboard-infra.json
└── team-data/
    ├── dashboard-pipeline.json
    └── dashboard-analytics.json
```

**Platform team configuration:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `team-platform/`

**Data team configuration:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `team-data/`

This approach means fewer repositories to manage, but less isolation between teams.

## Alternative: Different branches per team

For teams that want their own branch in a shared repository, use a different branch per team.

**Platform team configuration:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `team-platform`
- **Path**: `grafana/`

**Data team configuration:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `team-data`
- **Path**: `grafana/`

This allows teams to use Git branch workflows for collaboration while sharing the same repository.

## Learn more

Refer to the following documents to learn more:

- [Git Sync permissions and access control](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/permissions-grafana/)
- [Git Sync key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts/)
- [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/usage-limits/)
- [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/)
