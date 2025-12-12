---
title: Primary–replica Git Sync high availability
menuTitle: Primary–replica HA
description: Use a primary Grafana instance with replicas for failover, all synchronized via Git Sync
weight: 40
---

# Primary–replica Git Sync high availability

Use a primary Grafana instance and one or more replicas synchronized with the same Git location to enable failover.

## Architecture

```text
...existing diagram from Scenario 4...
```

## Use it for

- **Automatic failover**: You need service continuity when the primary instance fails.
- **High availability**: Your organization requires guaranteed dashboard availability.
- **Simple HA setup**: You want high availability without the complexity of active–active.
- **Maintenance windows**: You perform updates while another instance serves traffic.
- **Business continuity**: Dashboard access can't tolerate downtime.

## Repository structure

```text
...existing structure from Scenario 4...
```

## Configuration parameters

Primary and replica:
- Repository: `your-org/grafana-manifests`
- Branch: `main`
- Path: `shared/`

## How it works

1. Both instances stay synchronized through Git.
2. Reverse proxy routes traffic to primary.
3. Users edit on primary. Git Sync commits changes.
4. Both instances pull latest changes to keep replica in sync.
5. On primary failure, proxy fails over to replica.

## Failover considerations

- Health checks and monitoring.
- Continuous syncing to minimize data loss.
- Plan failback (automatic or manual).
