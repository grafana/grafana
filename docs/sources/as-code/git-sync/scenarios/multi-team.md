---
title: Multiple team Git Sync
menuTitle: Shared instance
description: Use multiple Git repositories with one Grafana instance, one repository per team
weight: 60
aliases:
  - ../../../observability-as-code/git-sync/provision-resources/git-sync-deployment-scenarios/multi-team
  - ../../../observability-as-code/git-sync/scenarios/multi-team/
---

# Git Sync in a Grafana instance shared by multiple teams

Use a single Grafana instance with multiple Repository resources, one per team. Each team manages its own dashboards while sharing Grafana.

## Use it for

- **Team autonomy**: Different teams manage their own dashboards independently.
- **Organizational structure**: Dashboard organization aligns with team structure.
- **Resource efficiency**: Multiple teams share Grafana infrastructure.
- **Cost optimization**: You reduce infrastructure costs while maintaining team separation.
- **Collaboration**: Teams can view each other’s dashboards while managing their own.

## Architecture

```
┌─────────────────────────┐  ┌─────────────────────────┐
│  Platform Team Repo     │  │  Data Team Repo         │
│  platform-dashboards    │  │  data-dashboards        │
│                         │  │                         │
│  platform-dashboards/   │  │  data-dashboards/       │
│  └── grafana/           │  │  └── grafana/           │
│      ├── k8s.json       │  │      ├── pipeline.json  │
│      └── infra.json     │  │      └── analytics.json │
└─────────────────────────┘  └─────────────────────────┘
           ↕                            ↕
    Git Sync (grafana/)          Git Sync (grafana/)
           ↕                            ↕
        ┌──────────────────────────────────────┐
        │       Grafana Instance               │
        │                                      │
        │  Repository 1:                       │
        │  - repo: platform-dashboards         │
        │  → Creates "platform-dashboards"     │
        │                                      │
        │  Repository 2:                       │
        │  - repo: data-dashboards             │
        │  → Creates "data-dashboards"         │
        └──────────────────────────────────────┘
```

## Repository structure

**In Git (separate repositories):**

**Platform team repository:**

```
your-org/platform-dashboards
└── grafana/
    ├── dashboard-k8s.json
    └── dashboard-infra.json
```

**Data team repository:**

```
your-org/data-dashboards
└── grafana/
    ├── dashboard-pipeline.json
    └── dashboard-analytics.json
```

**In Grafana Dashboards view:**

```
Dashboards
├── 📁 platform-dashboards/
│   ├── Kubernetes Dashboard
│   └── Infrastructure Dashboard
└── 📁 data-dashboards/
    ├── Pipeline Dashboard
    └── Analytics Dashboard
```

- Two separate folders created (one per Repository resource).
- Folder names derived from repository names.
- Each team has complete control over their own repository.
- Teams can independently manage permissions, branches, and workflows in their repos.
- All teams can view each other's dashboards in Grafana but manage only their own.

## Configuration parameters

**Platform team repository:**

- **Repository**: `your-org/platform-dashboards`
- **Branch**: `main`
- **Path**: `grafana/`

**Data team repository:**

- **Repository**: `your-org/data-dashboards`
- **Branch**: `main`
- **Path**: `grafana/`

## How it works

1. Each team has their own Git repository for complete autonomy.
2. Each repository resource in Grafana creates a separate folder.
3. Platform team dashboards sync from `your-org/platform-dashboards` repository.
4. Data team dashboards sync from `your-org/data-dashboards` repository.
5. Teams can independently manage their repository settings, access controls, and workflows.
6. All teams can view each other's dashboards in Grafana but edit only their own.

## Scale to more teams

Adding additional teams is straightforward. For a third team, create a new repository and configure:

- **Repository**: `your-org/security-dashboards`
- **Branch**: `main`
- **Path**: `grafana/`

This creates a new "security-dashboards" folder in the same Grafana instance.

## Alternative: Shared repository with different paths

For teams that prefer sharing a single repository, use different paths to separate team dashboards:

**In Git:**

```
your-org/grafana-manifests
├── team-platform/
│   ├── dashboard-k8s.json
│   └── dashboard-infra.json
└── team-data/
    ├── dashboard-pipeline.json
    └── dashboard-analytics.json
```

**Configuration:**

**Platform team:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `team-platform/`

**Data team:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `team-data/`

This approach provides simpler repository management but less isolation between teams.

## Alternative: Different branches per team

For teams wanting their own branch in a shared repository:

**Platform team:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `team-platform`
- **Path**: `grafana/`

**Data team:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `team-data`
- **Path**: `grafana/`

This allows teams to use Git branch workflows for collaboration while sharing the same repository.
