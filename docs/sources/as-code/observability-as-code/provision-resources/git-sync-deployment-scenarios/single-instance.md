---
title: Single instance Git Sync
menuTitle: Single instance
description: Synchronize a single Grafana instance with a Git repository
weight: 10
---

# Single instance Git Sync

Use a single Grafana instance synchronized with a Git repository. This is the foundation for Git Sync and helps you understand bidirectional synchronization.

## Architecture

```text
...existing code block diagram from Scenario 1...
```

## Use it for

- **Getting started**: You want to learn how Git Sync works before implementing complex scenarios.
- **Personal projects**: Individual developers manage their own dashboards.
- **Small teams**: You have a simple setup without multiple environments or complex workflows.
- **Development environments**: You need quick prototyping and testing.

## Repository structure

```text
...existing code block structure from Scenario 1...
```

## Configuration parameters

- Repository: `your-org/grafana-manifests`
- Branch: `main`
- Path: `grafana/`

## How it works

1. When users create or modify dashboards in Grafana, Git Sync commits changes to the `grafana/` directory on the `main` branch.
2. When dashboard JSON files are added or modified in the `grafana/` directory, Git Sync pulls these changes into Grafana.
