---
title: Regional replication Git Sync
menuTitle: Regional replication
description: Synchronize multiple regional Grafana instances from a shared Git location
weight: 30
---

# Multi-region Git Sync

Deploy multiple Grafana instances across regions. Synchronize them with the same Git location to ensure consistent dashboards everywhere.

## Use it for

- **Geographic distribution**: You deploy Grafana close to users in different regions.
- **Latency reduction**: Users need fast dashboard access from their location.
- **Data sovereignty**: You keep dashboard data in specific regions.
- **High availability**: You need dashboard availability across regions.
- **Consistent experience**: All users see the same dashboards regardless of region.

## Architecture

```text
...existing diagram from Scenario 3...
```

## Repository structure

```text
...existing structure from Scenario 3...
```

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

- Write conflicts use last-write-wins.
- Consider a primary region for edits.
- Ensure reliable connectivity to Git.
