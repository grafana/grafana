---
title: Git Sync deployment scenarios
menuTitle: Deployment scenarios
description: Learn about common Git Sync deployment patterns and configurations for different organizational needs
weight: 450
keywords:
  - git sync
  - deployment patterns
  - scenarios
  - multi-environment
  - teams
---

# Git Sync deployment scenarios

This guide shows practical deployment scenarios for Grafana’s Git Sync. Learn how to configure bidirectional synchronization between Grafana and Git repositories for teams, environments, and regions.

{{< admonition type="caution" >}}
Git Sync is an experimental feature. It reflects Grafana’s approach to Observability as Code and might include limitations or breaking changes. For current status and known limitations, refer to the [Git Sync introduction](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/intro-git-sync/).
{{< /admonition >}}

## Understand the relationship between key Git Sync components

Before you explore the scenarios, understand how the key Git Sync components relate:

- [Grafana instance](#grafana-instance)
- [Git repository structure](#git-repository-structure)
- [Git Sync repository resource](#git-sync-repository-resource)

### Grafana instance

A Grafana instance is a running Grafana server. Multiple instances can:

- Connect to the same Git repository using different Repository configurations.
- Sync from different branches of the same repository.
- Sync from different paths within the same repository.
- Sync from different repositories.

### Git repository structure

You can organize your Git repository in several ways:

- Single branch, multiple paths: Use different directories for different purposes (for example, `dev/`, `prod/`, `team-a/`).
- Multiple branches: Use different branches for different environments or teams (for example, `main`, `develop`, `team-a`).
- Multiple repositories: Use separate repositories for different teams or environments.

### Git Sync repository resource

A repository resource is a Grafana configuration object that defines:

- Which Git repository to sync with.
- Which branch to use.
- Which directory path to synchronize.
- Sync behavior and workflows.

Each repository resource creates bidirectional synchronization between a Grafana instance and a specific location in Git.

### How does repository sync behave?

With Git Sync you configure a repository resource to sync with your Grafana instance:

1. Grafana monitors the specified Git location (repository, branch, and path).
2. Grafana creates a folder in Dashboards (typically named after the repository).
3. Grafana creates dashboards from dashboard JSON files in Git within this folder.
4. Grafana commits dashboard changes made in the UI back to Git.
5. Grafana pulls dashboard changes made in Git and updates dashboards in the UI.
6. Synchronization occurs at regular intervals (configurable), or instantly if you use webhooks.

You can find the provisioned dashboards organized in folders under **Dashboards**.

### Example: Relationship between repository, branch, and path

Here's a concrete example showing how the three parameters work together:

**Configuration:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `team-platform/grafana/`

**In Git (on branch `main`):**

```
your-org/grafana-manifests/
├── .git/
├── README.md
├── team-platform/
│   └── grafana/
│       ├── cpu-metrics.json       ← Synced
│       ├── memory-usage.json      ← Synced
│       └── disk-io.json           ← Synced
├── team-data/
│   └── grafana/
│       └── pipeline-stats.json    ← Not synced (different path)
└── other-files.txt                 ← Not synced (outside path)
```

**In Grafana Dashboards view:**

```
Dashboards
└── 📁 grafana-manifests/
    ├── CPU Metrics Dashboard
    ├── Memory Usage Dashboard
    └── Disk I/O Dashboard
```

**Key points:**

- Grafana only synchronizes files within the specified path (`team-platform/grafana/`).
- Grafana ignores files in other paths or at the repository root.
- The folder name in Grafana comes from the repository name.
- Dashboard titles come from the JSON file content, not the filename.

## Repository configuration flexibility

Git Sync repositories support different combinations of repository URL, branch, and path:

- Different Git repositories: Each environment or team can use its own repository.
  - Instance A: `repository: your-org/grafana-prod`.
  - Instance B: `repository: your-org/grafana-dev`.
- Different branches: Use separate branches within the same repository.
  - Instance A: `repository: your-org/grafana-manifests, branch: main`.
  - Instance B: `repository: your-org/grafana-manifests, branch: develop`.
- Different paths: Use different directory paths within the same repository.
  - Instance A: `repository: your-org/grafana-manifests, branch: main, path: production/`.
  - Instance B: `repository: your-org/grafana-manifests, branch: main, path: development/`.
- Any combination: Mix and match based on your workflow requirements.

## Scenario 1: Single instance setup

### Overview

A single Grafana instance synchronized with a Git repository. This is the foundation for Git Sync and helps you understand how bidirectional synchronization works.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│           GitHub Repository                         │
│   Repository: your-org/grafana-manifests          │
│   Branch: main                                      │
│                                                     │
│   grafana-manifests/                              │
│   └── grafana/                                     │
│       ├── dashboard-1.json                         │
│       ├── dashboard-2.json                         │
│       └── dashboard-3.json                         │
└─────────────────────────────────────────────────────┘
                        ↕
              Git Sync (bidirectional)
                        ↕
        ┌─────────────────────────────┐
        │    Grafana Instance         │
        │                             │
        │  Repository Resource:       │
        │  - url: grafana-manifests  │
        │  - branch: main             │
        │  - path: grafana/           │
        │                             │
        │  Creates folder:            │
        │  "grafana-manifests"       │
        └─────────────────────────────┘
```

### Use it for

- **Getting started**: You want to learn how Git Sync works before implementing complex scenarios.
- **Personal projects**: Individual developers manage their own dashboards.
- **Small teams**: You have a simple setup without multiple environments or complex workflows.
- **Development environments**: You need quick prototyping and testing.

### Repository structure

**In Git:**

```
your-org/grafana-manifests
└── grafana/
    ├── dashboard-1.json
    ├── dashboard-2.json
    └── dashboard-3.json
```

**In Grafana Dashboards view:**

```
Dashboards
└── 📁 grafana-manifests/
    ├── Dashboard 1
    ├── Dashboard 2
    └── Dashboard 3
```

- A folder named "grafana-manifests" (from repository name) contains all synced dashboards.
- Each JSON file becomes a dashboard with its title displayed in the folder.
- Users browse dashboards organized under this folder structure.

### Configuration parameters

Configure your Grafana instance to synchronize with:
- **Repository**: `your-org/grafana-manifests`.
- **Branch**: `main`.
- **Path**: `grafana/`.

### How it works

1. When users create or modify dashboards in Grafana, Git Sync commits changes to the `grafana/` directory on the `main` branch.
2. When dashboard JSON files are added or modified in the `grafana/` directory, Git Sync pulls these changes into Grafana.

## Scenario 2: Development and production environments

### Overview

Use two separate Grafana instances for development and production. Each synchronizes with different locations in Git. This lets you test dashboards in development before you promote them to production.

### Architecture

```
┌────────────────────────────────────────────────────────────┐
│              GitHub Repository                             │
│   Repository: your-org/grafana-manifests                 │
│   Branch: main                                             │
│                                                            │
│   grafana-manifests/                                     │
│   ├── dev/                                                │
│   │   ├── dashboard-new.json    ← Development dashboards │
│   │   └── dashboard-test.json                            │
│   │                                                       │
│   └── prod/                                               │
│       ├── dashboard-stable.json  ← Production dashboards │
│       └── dashboard-approved.json                        │
└────────────────────────────────────────────────────────────┘
           ↕                                 ↕
    Git Sync (dev/)              Git Sync (prod/)
           ↕                                 ↕
┌─────────────────────┐          ┌─────────────────────┐
│  Dev Grafana        │          │  Prod Grafana       │
│                     │          │                     │
│  Repository:        │          │  Repository:        │
│  - path: dev/       │          │  - path: prod/      │
│                     │          │                     │
│  Creates folder:    │          │  Creates folder:    │
│  "grafana-manifests"│         │  "grafana-manifests"│
└─────────────────────┘          └─────────────────────┘
```

### Use it for

- **Staged deployments**: You need to test dashboard changes before production deployment.
- **Change control**: You require approvals before dashboards reach production.
- **Quality assurance**: You verify dashboard functionality in a non-production environment.
- **Risk mitigation**: You minimize the risk of breaking production dashboards.

### Repository structure

**In Git:**

```
your-org/grafana-manifests
├── dev/
│   ├── dashboard-new.json
│   └── dashboard-test.json
└── prod/
    ├── dashboard-stable.json
    └── dashboard-approved.json
```

**In Grafana Dashboards view:**

**Dev instance:**

```
Dashboards
└── 📁 grafana-manifests/
    ├── New Dashboard
    └── Test Dashboard
```

**Prod instance:**

```
Dashboards
└── 📁 grafana-manifests/
    ├── Stable Dashboard
    └── Approved Dashboard
```

- Both instances create a folder named "grafana-manifests" (from repository name).
- Each instance only shows dashboards from its configured path (`dev/` or `prod/`).
- Dashboards appear with their titles from the JSON files.

### Configuration parameters

**Development instance:**
- **Repository**: `your-org/grafana-manifests`.
- **Branch**: `main`.
- **Path**: `dev/`.

**Production instance:**
- **Repository**: `your-org/grafana-manifests`.
- **Branch**: `main`.
- **Path**: `prod/`.

### How it works

1. Developers create and modify dashboards in the development Grafana instance.
2. Git Sync commits changes to the `dev/` directory.
3. You review changes in Git (for example, pull requests).
4. You promote approved dashboards from `dev/` to `prod/`.
5. The production instance syncs changes from the `prod/` directory.
6. Production dashboards update.

### Alternative: Use branches

Instead of using different paths, you can configure instances to use different branches:

**Development instance:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `develop`
- **Path**: `grafana/`

**Production instance:**

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `grafana/`

With this approach:

- Development changes go to the `develop` branch.
- Use Git merge or pull request workflows to promote changes from `develop` to `main`.
- Production automatically syncs from the `main` branch.

### Alternative: Use separate repositories

For stricter isolation, use completely separate repositories:

**Development instance:**

- **Repository**: `your-org/grafana-manifests-dev`
- **Branch**: `main`
- **Path**: `grafana/`

**Production instance:**

- **Repository**: `your-org/grafana-manifests-prod`
- **Branch**: `main`
- **Path**: `grafana/`

## Scenario 3: Multi-region deployment

### Overview

Deploy multiple Grafana instances across different geographic regions. All synchronize with the same Git location to ensure consistent dashboards everywhere.

### Architecture

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

### Use it for

- **Geographic distribution**: You deploy Grafana close to users in different regions.
- **Latency reduction**: Users need fast dashboard access from their location.
- **Data sovereignty**: You keep dashboard data in specific geographic regions.
- **High availability**: You need dashboard availability across regions.
- **Consistent experience**: All users see the same dashboards regardless of region.

### Repository structure

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

- All regional instances (US, EU, etc.) show identical folder structure.
- Same folder name "grafana-manifests" in every region.
- Same dashboards synced from the `shared/` path appear everywhere.
- Users in any region see the exact same dashboards with the same titles.

### Configuration parameters

All regional instances use identical parameters:

**US Region instance:**
- **Repository**: `your-org/grafana-manifests`.
- **Branch**: `main`.
- **Path**: `shared/`.

**EU Region instance:**
- **Repository**: `your-org/grafana-manifests`.
- **Branch**: `main`.
- **Path**: `shared/`.

### How it works

1. All regional instances pull dashboards from the same `shared/` directory.
2. When a user modifies a dashboard in any region, Git Sync commits the change.
3. All other regions pull the updated dashboard during their next sync cycle.
4. Changes propagate across regions within the configured sync interval, or instantly if you use webhooks.

### Important considerations

- **Write conflicts**: If users in different regions modify the same dashboard at the same time, Git uses last-write-wins.
- **Propagation time**: Changes propagate within the configured sync interval, or instantly if you use webhooks.
- **Primary region**: Consider designating one region as the primary location for making dashboard changes.
- **Network reliability**: Ensure each region has reliable connectivity to the Git repository.

## Scenario 4: High availability with primary–replica setup

### Overview

Use a high availability configuration with a primary Grafana instance and one or more replicas. All synchronize with the same Git location. This setup provides redundancy and enables zero-downtime maintenance.

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
│  Primary Grafana    │          │  Replica Grafana   │
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

### Use it for

- **Automatic failover**: You need service continuity when the primary instance fails.
- **High availability**: Your organization requires guaranteed dashboard availability.
- **Simple HA setup**: You want high availability without the complexity of active–active.
- **Maintenance windows**: You perform updates on one instance while another serves traffic.
- **Business continuity**: Dashboard access is critical and cannot tolerate downtime.

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

Both primary and replica instances use identical parameters:

**Primary instance:**
- **Repository**: `your-org/grafana-manifests`.
- **Branch**: `main`.
- **Path**: `shared/`.

**Replica instance:**
- **Repository**: `your-org/grafana-manifests`.
- **Branch**: `main`.
- **Path**: `shared/`.

### How it works

1. Both instances stay synchronized through Git.
2. A reverse proxy routes traffic to the primary instance.
3. Users make dashboard changes on the primary. Git Sync commits changes to Git.
4. Both instances pull the latest changes during sync cycles, keeping the replica up to date.
5. If the primary fails health checks, the proxy fails over to the replica.
6. The replica becomes active and serves traffic.

### Failover considerations

- Configure health checks to detect primary failures quickly.
- Keep the replica continuously syncing to minimize data loss during failover.
- Decide on automatic or manual failback to the primary.
- Implement monitoring and alerting for instance health and failover events.
- Git Sync ensures both instances have identical dashboards for seamless failover.

## Scenario 5: Active–active high availability

### Overview

Run multiple Grafana instances that actively serve traffic at the same time. A load balancer distributes requests between them. All instances sync from the same Git location and accept dashboard changes, providing high availability and load distribution.

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

### Use it for

- **High traffic**: Your deployment needs to handle significant user load.
- **Load distribution**: You want to distribute user requests across instances.
- **Maximum availability**: You need service to continue during maintenance or failures.
- **Scalability**: You want to add instances as load increases.
- **Performance**: Users need fast response times under heavy load.

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
- **Repository**: `your-org/grafana-manifests`.
- **Branch**: `main`.
- **Path**: `shared/`.

**Instance 2:**
- **Repository**: `your-org/grafana-manifests`.
- **Branch**: `main`.
- **Path**: `shared/`.

### How it works

1. All instances stay synchronized through Git.
2. A load balancer distributes incoming traffic across instances.
3. Users can view dashboards from any instance.
4. When a user modifies a dashboard on any instance, Git Sync commits the change.
5. Other instances pull the updated dashboard during their next sync cycle, or instantly with webhooks.
6. If one instance fails, the load balancer stops routing traffic to it and remaining instances continue serving.

### Important considerations

- **Eventual consistency**: Due to sync intervals, instances may briefly have different dashboard versions.
- **Concurrent edits**: Multiple users editing the same dashboard on different instances can cause conflicts.
- **Database sharing**: Share the same backend database for sessions, preferences, and annotations.
- **Stateless design**: Design for stateless operation to maximize load balancing effectiveness.

## Scenario 6: Multi-team configuration

### Overview

Use a single Grafana instance with multiple Repository resources for different teams. Each team has its own Git repository and manages its dashboards independently while sharing Grafana infrastructure.

### Architecture

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

### Use it for

- **Team autonomy**: Different teams manage their own dashboards independently.
- **Organizational structure**: Dashboard organization aligns with team structure.
- **Resource efficiency**: Multiple teams share Grafana infrastructure.
- **Cost optimization**: You reduce infrastructure costs while maintaining team separation.
- **Collaboration**: Teams can view each other’s dashboards while managing their own.

### Repository structure

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

### Configuration parameters

**Platform team repository:**
- **Repository**: `your-org/platform-dashboards`.
- **Branch**: `main`.
- **Path**: `grafana/`.

**Data team repository:**
- **Repository**: `your-org/data-dashboards`.
- **Branch**: `main`.
- **Path**: `grafana/`.

### How it works

1. Each team uses its own Git repository for autonomy.
2. Each Repository resource in Grafana creates a separate folder.
3. The platform team syncs dashboards from `your-org/platform-dashboards`.
4. The data team syncs dashboards from `your-org/data-dashboards`.
5. Teams manage repository settings, access controls, and workflows independently.
6. All teams can view each other’s dashboards in Grafana but can edit only their own.

### Scale to more teams

To add another team, create a new repository and configure:
- **Repository**: `your-org/security-dashboards`.
- **Branch**: `main`.
- **Path**: `grafana/`.

This creates a new `security-dashboards` folder in the same Grafana instance.

### Alternative: Shared repository with different paths

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

### Alternative: Different branches per team

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

## Learn more

Refer to the following documents to learn more:

- [Git Sync introduction](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/intro-git-sync/).
- [Git Sync setup guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/git-sync-setup/).
- [Dashboard provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/).
- [Observability as Code](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/).
