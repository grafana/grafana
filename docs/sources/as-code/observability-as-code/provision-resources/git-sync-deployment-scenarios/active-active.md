---
title: Active–active Git Sync high availability
menuTitle: Active–active HA
description: Run multiple Grafana instances serving traffic simultaneously, synchronized via Git Sync
weight: 50
---

# Active–active Git Sync high availability

Run multiple active Grafana instances behind a load balancer. All instances sync from the same Git location.

## Architecture

```text
...existing diagram from Scenario 5...
```

## Use it for

- **High traffic**: Your deployment needs to handle significant user load.
- **Load distribution**: You want to distribute user requests across instances.
- **Maximum availability**: You need service continuity during maintenance or failures.
- **Scalability**: You want to add instances as load increases.
- **Performance**: Users need fast response times under heavy load.

## Repository structure

```text
...existing structure from Scenario 5...
```

## Configuration parameters

All instances:
- Repository: `your-org/grafana-manifests`
- Branch: `main`
- Path: `shared/`

## How it works

1. Instances stay synchronized through Git.
2. Load balancer distributes traffic.
3. Any instance can serve reads and accept modifications.
4. Changes propagate to all instances via Git (sync interval or webhooks).

## Important considerations

- Eventual consistency across sync intervals.
- Concurrent edits can cause conflicts.
- Share the same backend database for sessions and annotations.
- Favor stateless design to maximize load balancing.
