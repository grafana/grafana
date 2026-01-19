---
title: Git Sync with regional replication
menuTitle: Regional replication
description: Synchronize multiple regional Grafana instances from a shared Git location
weight: 30
---

# Git Sync with regional replication

Deploy multiple Grafana instances across regions. Synchronize them with the same Git location to ensure consistent dashboards everywhere.

## Use it for

- **Geographic distribution**: You deploy Grafana close to users in different regions.
- **Latency reduction**: Users need fast dashboard access from their location.
- **Data sovereignty**: You keep dashboard data in specific regions.
- **High availability**: You need dashboard availability across regions.
- **Consistent experience**: All users see the same dashboards regardless of region.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           GitHub Repository                         │
│   Repository: your-org/grafana-manifests          │
│   Branch: main                                      │
│                                                     │
│   grafana-manifests/                              │
│   └── shared/                                      │
│       ├── dashboard-global.json                    │
│       ├── dashboard-metrics.json                   │
│       └── dashboard-logs.json                      │
└─────────────────────────────────────────────────────┘
              ↕                           ↕
       Git Sync (shared/)         Git Sync (shared/)
              ↕                           ↕
┌────────────────────┐          ┌────────────────────┐
│  US Region         │          │  EU Region         │
│  Grafana           │          │  Grafana           │
│                    │          │                    │
│  Repository:       │          │  Repository:       │
│  - path: shared/   │          │  - path: shared/   │
└────────────────────┘          └────────────────────┘
```

## Repository structure

**In Git:**

```
your-org/grafana-manifests
└── shared/
    ├── dashboard-global.json
    ├── dashboard-metrics.json
    └── dashboard-logs.json
```

**In Grafana Dashboards view (all regions):**

```
Dashboards
└── 📁 grafana-manifests/
    ├── Global Dashboard
    ├── Metrics Dashboard
    └── Logs Dashboard
```

- All regional instances (US, EU, etc.) show identical folder structure
- Same folder name "grafana-manifests" in every region
- Same dashboards synced from the `shared/` path appear everywhere
- Users in any region see the exact same dashboards with the same titles

## Configuration parameters

All regions:

- Repository: `your-org/grafana-manifests`
- Branch: `main`
- Path: `shared/`

## How it works

1. All regional instances pull dashboards from `shared/`.
2. Any region’s change commits to Git.
3. Other regions pull updates during the next sync (or via webhooks).
4. Changes propagate across regions per sync interval.

## Considerations

- **Write conflicts**: If users in different regions modify the same dashboard simultaneously, Git uses last-write-wins.
- **Primary region**: Consider designating one region as the primary location for making dashboard changes.
- **Propagation time**: Changes propagate to all regions within the configured sync interval, or instantly if webhooks are configured.
- **Network reliability**: Ensure all regions have reliable connectivity to the Git repository.
