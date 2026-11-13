---
title: Git Sync with regional replication
menuTitle: Regional replication
description: Synchronize multiple regional Grafana instances from a shared Git location
weight: 30
keywords:
  - git sync
  - deployment patterns
  - scenarios
  - multi-region
  - replication
labels:
  products:
    - enterprise
    - oss
    - cloud
canonical: https://grafana.com/docs/grafana/latest/as-code/git-sync/scenarios/multi-region/
aliases:
  - ../../observability-as-code/git-sync/scenarios/multi-region/
  - ../../observability-as-code/provision-resources/git-sync-deployment-scenarios/multi-region/
  - ../../provision-resources/git-sync-deployment-scenarios/multi-region/
---

# Git Sync with regional replication

Deploy multiple Grafana instances across regions. Synchronize them with the same Git location to ensure consistent dashboards everywhere.

Before you begin, ensure you have the following:

- A Git repository hosted on a [compatible Git provider](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/usage-limits/#compatible-git-providers).
- A Grafana instance in each region that meets the [Git Sync setup prerequisites](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-before/).
- Network connectivity from every regional instance to your Git provider.

## Use it for

Use this scenario in the following situations:

- **Geographic distribution**: You deploy Grafana close to users in different regions.
- **Latency reduction**: Users need fast dashboard access from their location.
- **Data sovereignty**: You keep dashboard data in specific regions.
- **High availability**: You need dashboard availability across regions.
- **Consistent experience**: All users see the same dashboards regardless of region.

## Architecture

In this scenario, every regional instance syncs the same path of the same branch:

```text
┌─────────────────────────────────────────────┐
│ GitHub Repository                           │
│ Repository: your-org/grafana-manifests      │
│ Branch: main                                │
│                                             │
│ grafana-manifests/                          │
│ └── shared/                                 │
│     ├── dashboard-global.json               │
│     ├── dashboard-metrics.json              │
│     └── dashboard-logs.json                 │
└─────────────────────────────────────────────┘
          ↕                           ↕
   Git Sync (shared/)          Git Sync (shared/)
          ↕                           ↕
┌────────────────────┐      ┌────────────────────┐
│ US Region          │      │ EU Region          │
│ Grafana            │      │ Grafana            │
│                    │      │                    │
│ Repository:        │      │ Repository:        │
│ - path: shared/    │      │ - path: shared/    │
└────────────────────┘      └────────────────────┘
```

## Repository structure

The following examples show how the dashboards appear in Git and in every regional instance.

**In Git:**

```text
your-org/grafana-manifests
└── shared/
    ├── dashboard-global.json
    ├── dashboard-metrics.json
    └── dashboard-logs.json
```

**In Grafana Dashboards view (all regions):**

```text
Dashboards
└── 📁 grafana-manifests/
    ├── Global Dashboard
    ├── Metrics Dashboard
    └── Logs Dashboard
```

- All regional instances (US, EU, and so on) show an identical folder structure.
- Every region has the same folder name, `grafana-manifests`.
- The same dashboards, synced from the `shared/` path, appear everywhere.
- Users in any region see the exact same dashboards with the same titles.

## Configuration parameters

Configure every regional instance with the following parameters:

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `shared/`

## How it works

Changes made in any region reach the other regions through Git:

1. All regional instances pull dashboards from `shared/`.
2. Any region's change commits to Git.
3. Other regions pull updates during the next sync, or immediately if you use webhooks.
4. Changes propagate across regions per sync interval.

## Considerations

Keep the following in mind when you run this scenario:

- **Write conflicts**: If users in different regions modify the same dashboard simultaneously, the last written changes prevail.
- **Primary region**: Consider designating one region as the primary location for making dashboard changes.
- **Propagation time**: Changes propagate to all regions within the configured sync interval, or instantly if you configure webhooks.
- **Network reliability**: Ensure all regions have reliable connectivity to the Git repository.

## Learn more

Refer to the following documents to learn more:

- [Git Sync for high availability environments](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/scenarios/high-availability/)
- [Git Sync key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts/)
- [Instantaneous pulling and dashboard previews](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-extend/)
- [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/usage-limits/)
