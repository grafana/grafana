---
title: Single instance Git Sync
menuTitle: Single instance
description: Synchronize a single Grafana instance with a Git repository
weight: 10
---

# Single instance Git Sync

Use a single Grafana instance synchronized with a Git repository. This is the foundation for Git Sync and helps you understand bidirectional synchronization.

## Use it for

- **Getting started**: You want to learn how Git Sync works before implementing complex scenarios.
- **Personal projects**: Individual developers manage their own dashboards.
- **Small teams**: You have a simple setup without multiple environments or complex workflows.
- **Development environments**: You need quick prototyping and testing.

## Architecture

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

## Repository structure

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

## Configuration parameters

Configure your Grafana instance to synchronize with:

- **Repository**: `your-org/grafana-manifests`
- **Branch**: `main`
- **Path**: `grafana/`

## How it works

1. **From Grafana to Git**: When users create or modify dashboards in Grafana, Git Sync commits changes to the `grafana/` directory on the `main` branch.
2. **From Git to Grafana**: When dashboard JSON files are added or modified in the `grafana/` directory, Git Sync pulls these changes into Grafana.

