---
title: Git Sync for high availability environments
menuTitle: High availability
description: Run multiple Grafana instances serving traffic simultaneously, synchronized via Git Sync
weight: 50
keywords:
  - git sync
  - deployment patterns
  - scenarios
  - high availability
  - load balancing
labels:
  products:
    - enterprise
    - oss
    - cloud
canonical: https://grafana.com/docs/grafana/latest/as-code/git-sync/scenarios/high-availability/
aliases:
  - ../../observability-as-code/git-sync/scenarios/high-availability/
  - ../../observability-as-code/provision-resources/git-sync-deployment-scenarios/high-availability/
  - ../../provision-resources/git-sync-deployment-scenarios/high-availability/
---

# Git Sync for high availability environments

Run multiple Grafana instances synchronized with the same Git location so your dashboards stay available when an instance fails or is under maintenance. This guide covers two high availability scenarios:

- [Primary-replica scenario](#primary-replica-scenario): One active instance serves traffic, and a standby replica takes over on failure.
- [Load balancer scenario](#load-balancer-scenario): Multiple active instances share traffic behind a load balancer.

Before you begin, ensure you have the following:

- A Git repository hosted on a [compatible Git provider](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/usage-limits/#compatible-git-providers).
- Two or more Grafana instances that meet the [Git Sync setup prerequisites](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-before/).
- A reverse proxy or load balancer in front of your Grafana instances.

## Primary-replica scenario

Use a primary Grafana instance and one or more replicas synchronized with the same Git location, so a replica can take over if the primary fails.

### Use it for

Use this scenario in the following situations:

- **Service continuity**: You need a replica to take over automatically when the primary instance fails.
- **High availability**: Your organization requires guaranteed dashboard availability.
- **Minimal HA setup**: You want high availability without the complexity of active-active.
- **Maintenance windows**: You perform updates while another instance serves traffic.
- **Business continuity**: Dashboard access can't tolerate downtime.

### Architecture

In this scenario, a reverse proxy routes traffic to the primary instance and fails over to the replica:

```text
┌─────────────────────────────────────────────┐
│ GitHub Repository                           │
│ Repository: your-org/grafana-manifests      │
│ Branch: main                                │
│                                             │
│ grafana-manifests/                          │
│ └── shared/                                 │
│     ├── dashboard-metrics.json              │
│     ├── dashboard-alerts.json               │
│     └── dashboard-logs.json                 │
└─────────────────────────────────────────────┘
          ↕                           ↕
   Git Sync (shared/)          Git Sync (shared/)
          ↕                           ↕
┌────────────────────┐      ┌────────────────────┐
│ Primary Grafana    │      │ Replica Grafana    │
│ (Active)           │      │ (Standby)          │
│                    │      │                    │
│ Repository:        │      │ Repository:        │
│ - path: shared/    │      │ - path: shared/    │
└────────────────────┘      └────────────────────┘
          │                           │
          └─────────────┬─────────────┘
                        ↓
             ┌────────────────────┐
             │ Reverse Proxy      │
             │ (Failover)         │
             └────────────────────┘
```

### Repository structure

The following examples show how the dashboards appear in Git and in both instances.

**In Git:**

```text
your-org/grafana-manifests
└── shared/
    ├── dashboard-metrics.json
    ├── dashboard-alerts.json
    └── dashboard-logs.json
```

**In Grafana Dashboards view (both instances):**

```text
Dashboards
└── 📁 grafana-manifests/
    ├── Metrics Dashboard
    ├── Alerts Dashboard
    └── Logs Dashboard
```

- Primary and replica instances show an identical folder structure.
- Both instances sync from the same `shared/` path.
- The reverse proxy routes traffic to the primary (active) instance.
- If the primary fails, the proxy automatically fails over to the replica (standby).
- Users see the same dashboards regardless of which instance is serving traffic.

### Configuration parameters

Both primary and replica instances use identical parameters.

**Primary instance:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `shared/`

**Replica instance:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `shared/`

### How it works

The primary serves traffic while Git keeps the replica up to date:

1. Both instances stay synchronized through Git.
2. The reverse proxy routes traffic to the primary.
3. Users edit on the primary, and Git Sync commits the changes.
4. Both instances pull the most recent changes, which keeps the replica in sync.
5. If the primary fails, the proxy fails over to the replica.

### Primary failure considerations

Plan for the following in case the primary fails:

- **Health checks**: Set up health checks and monitoring so the proxy detects when the primary fails.
- **Sync frequency**: Keep syncing continuous to minimize data loss when the replica takes over.
- **Return to the primary**: Decide whether traffic returns to the primary automatically or manually after it recovers.

## Load balancer scenario

Run multiple active Grafana instances behind a load balancer. All instances sync from the same Git location.

### Use it for

Use this scenario in the following situations:

- **High traffic**: Your deployment needs to handle significant user load.
- **Load distribution**: You want to distribute user requests across instances.
- **Maximum availability**: You need service continuity during maintenance or failures.
- **Scalability**: You want to add instances as load increases.
- **Performance**: Users need fast response times under heavy load.

### Architecture

In this scenario, a load balancer distributes traffic across all active instances:

```text
┌─────────────────────────────────────────────┐
│ GitHub Repository                           │
│ Repository: your-org/grafana-manifests      │
│ Branch: main                                │
│                                             │
│ grafana-manifests/                          │
│ └── shared/                                 │
│     ├── dashboard-metrics.json              │
│     ├── dashboard-alerts.json               │
│     └── dashboard-logs.json                 │
└─────────────────────────────────────────────┘
          ↕                           ↕
   Git Sync (shared/)          Git Sync (shared/)
          ↕                           ↕
┌────────────────────┐      ┌────────────────────┐
│ Grafana Instance 1 │      │ Grafana Instance 2 │
│ (Active)           │      │ (Active)           │
│                    │      │                    │
│ Repository:        │      │ Repository:        │
│ - path: shared/    │      │ - path: shared/    │
└────────────────────┘      └────────────────────┘
          │                           │
          └─────────────┬─────────────┘
                        ↓
             ┌────────────────────┐
             │ Load Balancer      │
             │ (Round Robin)      │
             └────────────────────┘
```

### Repository structure

The following examples show how the dashboards appear in Git and in every instance.

**In Git:**

```text
your-org/grafana-manifests
└── shared/
    ├── dashboard-metrics.json
    ├── dashboard-alerts.json
    └── dashboard-logs.json
```

**In Grafana Dashboards view (all instances):**

```text
Dashboards
└── 📁 grafana-manifests/
    ├── Metrics Dashboard
    ├── Alerts Dashboard
    └── Logs Dashboard
```

- All instances show an identical folder structure.
- All instances sync from the same `shared/` path.
- The load balancer distributes requests across all active instances.
- Any instance can serve read requests.
- Any instance can accept dashboard modifications.
- Changes propagate to all instances through Git.

### Configuration parameters

All instances use identical parameters.

**Instance 1:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `shared/`

**Instance 2:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `shared/`

### How it works

Every instance serves traffic and accepts changes, and Git keeps them consistent:

1. All instances stay synchronized through Git.
2. The load balancer distributes incoming traffic across all active instances.
3. Users can view dashboards from any instance.
4. When a user modifies a dashboard on any instance, Git Sync commits the change.
5. All other instances pull the updated dashboard during their next sync cycle, or instantly if you configure webhooks.
6. If one instance fails, the load balancer stops routing traffic to it and the remaining instances continue serving.

### Important considerations

Keep the following in mind when you run this scenario:

- **Eventually consistent**: Due to sync intervals, instances may briefly have different dashboard versions.
- **Concurrent edits**: Multiple users editing the same dashboard on different instances can cause conflicts.
- **Database sharing**: Instances should share the same backend database for user sessions, preferences, and annotations.
- **Stateless design**: Design for stateless operation where possible to maximize load balancing effectiveness.

## Learn more

Refer to the following documents to learn more:

- [Git Sync with regional replication](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/scenarios/multi-region/)
- [Git Sync key concepts](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/key-concepts/)
- [Instantaneous pulling and dashboard previews](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/git-sync/git-sync-setup/set-up-extend/)
- [Set up Grafana for high availability](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/set-up-for-high-availability/)
