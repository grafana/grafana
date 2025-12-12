---
title: Git Sync for high availability environments
menuTitle: High availability
description: Run multiple Grafana instances serving traffic simultaneously, synchronized via Git Sync
weight: 50
---

# Git Sync for high availability environments

## Primary–replica Git Sync scenario

Use a primary Grafana instance and one or more replicas synchronized with the same Git location to enable failover.

### Use it for

- **Automatic failover**: You need service continuity when the primary instance fails.
- **High availability**: Your organization requires guaranteed dashboard availability.
- **Simple HA setup**: You want high availability without the complexity of active–active.
- **Maintenance windows**: You perform updates while another instance serves traffic.
- **Business continuity**: Dashboard access can't tolerate downtime.

### Architecture

```text
...existing diagram from Scenario 4...
```

### Repository structure

```text
...existing structure from Scenario 4...
```

### Configuration parameters

Primary and replica:

- Repository: `your-org/grafana-manifests`
- Branch: `main`
- Path: `shared/`

### How it works

1. Both instances stay synchronized through Git.
2. Reverse proxy routes traffic to primary.
3. Users edit on primary. Git Sync commits changes.
4. Both instances pull latest changes to keep replica in sync.
5. On primary failure, proxy fails over to replica.

### Failover considerations

- Health checks and monitoring.
- Continuous syncing to minimize data loss.
- Plan failback (automatic or manual).

## Load balancer scenario

Run multiple active Grafana instances behind a load balancer. All instances sync from the same Git location.

### Use it for

- **High traffic**: Your deployment needs to handle significant user load.
- **Load distribution**: You want to distribute user requests across instances.
- **Maximum availability**: You need service continuity during maintenance or failures.
- **Scalability**: You want to add instances as load increases.
- **Performance**: Users need fast response times under heavy load.

### Architecture

```text
...existing diagram from Scenario 5...
```

### Repository structure

```text
...existing structure from Scenario 5...
```

### Configuration parameters

All instances:

- Repository: `your-org/grafana-manifests`
- Branch: `main`
- Path: `shared/`

### How it works

1. Instances stay synchronized through Git.
2. Load balancer distributes traffic.
3. Any instance can serve reads and accept modifications.
4. Changes propagate to all instances via Git (sync interval or webhooks).

### Important considerations

- Eventual consistency across sync intervals.
- Concurrent edits can cause conflicts.
- Share the same backend database for sessions and annotations.
- Favor stateless design to maximize load balancing.
