---
title: Git Sync for high availability environments
menuTitle: High availability
description: Run multiple Grafana instances serving traffic simultaneously, synchronized via Git Sync
weight: 50
---

# Git Sync for high availability environments

## Primary–replica scenario

Use a primary Grafana instance and one or more replicas synchronized with the same Git location to enable failover.

### Use it for

- **Automatic failover**: You need service continuity when the primary instance fails.
- **High availability**: Your organization requires guaranteed dashboard availability.
- **Simple HA setup**: You want high availability without the complexity of active–active.
- **Maintenance windows**: You perform updates while another instance serves traffic.
- **Business continuity**: Dashboard access can't tolerate downtime.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│           GitHub Repository                         │
│   Repository: your-org/grafana-manifests          │
│   Branch: main                                      │
│                                                     │
│   grafana-manifests/                              │
│   └── shared/                                      │
│       ├── dashboard-metrics.json                   │
│       ├── dashboard-alerts.json                    │
│       └── dashboard-logs.json                      │
└─────────────────────────────────────────────────────┘
              ↕                           ↕
        Git Sync (shared/)        Git Sync (shared/)
              ↕                           ↕
┌────────────────────┐          ┌────────────────────┐
│  Master Grafana    │          │  Replica Grafana   │
│    (Active)        │          │    (Standby)       │
│                    │          │                    │
│  Repository:       │          │  Repository:       │
│  - path: shared/   │          │  - path: shared/   │
└────────────────────┘          └────────────────────┘
         │                               │
         └───────────┬───────────────────┘
                     ↓
          ┌──────────────────────┐
          │  Reverse Proxy       │
          │  (Failover)          │
          └──────────────────────┘
```

### Repository structure

**In Git:**

```
your-org/grafana-manifests
└── shared/
    ├── dashboard-metrics.json
    ├── dashboard-alerts.json
    └── dashboard-logs.json
```

**In Grafana Dashboards view (both instances):**

```
Dashboards
└── 📁 grafana-manifests/
    ├── Metrics Dashboard
    ├── Alerts Dashboard
    └── Logs Dashboard
```

- Master and replica instances show identical folder structure.
- Both sync from the same `shared/` path.
- Reverse proxy routes traffic to master (active) instance.
- If master fails, proxy automatically fails over to replica (standby).
- Users see the same dashboards regardless of which instance is serving traffic.

### Configuration parameters

Both master and replica instances use identical parameters:

**Master instance:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `shared/`

**Replica instance:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `shared/`

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

```
┌─────────────────────────────────────────────────────┐
│           GitHub Repository                         │
│   Repository: your-org/grafana-manifests          │
│   Branch: main                                      │
│                                                     │
│   grafana-manifests/                              │
│   └── shared/                                      │
│       ├── dashboard-metrics.json                   │
│       ├── dashboard-alerts.json                    │
│       └── dashboard-logs.json                      │
└─────────────────────────────────────────────────────┘
              ↕                           ↕
        Git Sync (shared/)        Git Sync (shared/)
              ↕                           ↕
┌────────────────────┐          ┌────────────────────┐
│  Grafana Instance 1│          │  Grafana Instance 2│
│    (Active)        │          │    (Active)        │
│                    │          │                    │
│  Repository:       │          │  Repository:       │
│  - path: shared/   │          │  - path: shared/   │
└────────────────────┘          └────────────────────┘
         │                               │
         └───────────┬───────────────────┘
                     ↓
          ┌──────────────────────┐
          │  Load Balancer       │
          │  (Round Robin)       │
          └──────────────────────┘
```

### Repository structure

**In Git:**

```
your-org/grafana-manifests
└── shared/
    ├── dashboard-metrics.json
    ├── dashboard-alerts.json
    └── dashboard-logs.json
```

**In Grafana Dashboards view (all instances):**

```
Dashboards
└── 📁 grafana-manifests/
    ├── Metrics Dashboard
    ├── Alerts Dashboard
    └── Logs Dashboard
```

- All instances show identical folder structure.
- All instances sync from the same `shared/` path.
- Load balancer distributes requests across all active instances.
- Any instance can serve read requests.
- Any instance can accept dashboard modifications.
- Changes propagate to all instances through Git.

### Configuration parameters

All instances use identical parameters:

**Instance 1:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `shared/`

**Instance 2:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `shared/`

### How it works

1. All instances stay synchronized through Git.
2. Load balancer distributes incoming traffic across all active instances.
3. Users can view dashboards from any instance.
4. When a user modifies a dashboard on any instance, Git Sync commits the change.
5. All other instances pull the updated dashboard during their next sync cycle, or instantly if webhooks are configured.
6. If one instance fails, load balancer stops routing traffic to it and remaining instances continue serving.

### Important considerations

- **Eventually consistent**: Due to sync intervals, instances may briefly have different dashboard versions.
- **Concurrent edits**: Multiple users editing the same dashboard on different instances can cause conflicts.
- **Database sharing**: Instances should share the same backend database for user sessions, preferences, and annotations.
- **Stateless design**: Design for stateless operation where possible to maximize load balancing effectiveness.
