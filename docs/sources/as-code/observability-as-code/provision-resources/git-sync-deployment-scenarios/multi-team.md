---
title: Multi-team Git Sync
menuTitle: Multi-team
description: Use multiple Git repositories with one Grafana instance, one repository per team
weight: 60
---

# Multi-team Git Sync

Use a single Grafana instance with multiple Repository resources, one per team. Each team manages its own dashboards while sharing Grafana.

## Architecture

```text
...existing diagram from Scenario 6...
```

## Use it for

- **Team autonomy**: Different teams manage their own dashboards independently.
- **Organizational structure**: Dashboard organization aligns with team structure.
- **Resource efficiency**: Multiple teams share Grafana infrastructure.
- **Cost optimization**: You reduce infrastructure costs while maintaining team separation.
- **Collaboration**: Teams can view each other’s dashboards while managing their own.

## Repository structure

```text
...existing structures from Scenario 6 (platform and data team)...
```

## Configuration parameters

Platform team:
- Repository: `your-org/platform-dashboards`
- Branch: `main`
- Path: `grafana/`

Data team:
- Repository: `your-org/data-dashboards`
- Branch: `main`
- Path: `grafana/`

## How it works

1. Each team uses its own Git repository.
2. Each Repository resource creates a separate folder.
3. Teams manage their repository settings and workflows independently.
4. Teams can view other teams’ dashboards but only edit their own.

## Alternatives

- Shared repository with different paths: `team-platform/`, `team-data/`.
- Shared repository with different branches per team.
