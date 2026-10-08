---
title: Git Sync for development and production environments
menuTitle: Across environments
description: Use separate Grafana instances for development and production with Git-controlled promotion
weight: 20
aliases:
  - ../../../observability-as-code/git-sync/provision-resources/git-sync-deployment-scenarios/dev-prod
  - ../../../observability-as-code/git-sync/scenarios/dev-prod/
---

# Git Sync for development and production environments

Use separate Grafana instances for development and production. Each syncs with different Git locations to test dashboards before production.

## Use it for

- **Staged deployments**: You need to test dashboard changes before production deployment.
- **Change control**: You require approvals before dashboards reach production.
- **Quality assurance**: You verify dashboard functionality in a non-production environment.
- **Risk mitigation**: You minimize the risk of breaking production dashboards.

## Architecture

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

## Repository structure

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

- Both instances create a folder named "grafana-manifests" (from repository name)
- Each instance only shows dashboards from its configured path (`dev/` or `prod/`)
- Dashboards appear with their titles from the JSON files

## Configuration parameters

Development:

- Repository: `your-org/grafana-manifests`
- Branch: `main`
- Path: `dev/`

Production:

- Repository: `your-org/grafana-manifests`
- Branch: `main`
- Path: `prod/`

## How it works

1. Developers create and modify dashboards in development.
2. Git Sync commits changes to `dev/`.
3. You review changes in Git.
4. You promote approved dashboards from `dev/` to `prod/`.
5. Production syncs from `prod/`.
6. Production dashboards update.

## Alternative: Use branches

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

- Development changes go to the `develop` branch
- Use Git merge or pull request workflows to promote changes from `develop` to `main`
- Production automatically syncs from the `main` branch

## Alternative: Use separate repositories for stricter isolation

For stricter isolation, use completely separate repositories:

**Development instance:**

- **Repository**: `your-org/grafana-manifests-dev`
- **Branch**: `main`
- **Path**: `grafana/`

**Production instance:**

- **Repository**: `your-org/grafana-manifests-prod`
- **Branch**: `main`
- **Path**: `grafana/`
