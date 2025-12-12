---
title: Git Sync for development and production environments
menuTitle: Across environments
description: Use separate Grafana instances for development and production with Git-controlled promotion
weight: 20
---

# Git Sync for development and production environments

Use separate Grafana instances for development and production. Each syncs with different Git locations to test dashboards before production.

## Use it for

- **Staged deployments**: You need to test dashboard changes before production deployment.
- **Change control**: You require approvals before dashboards reach production.
- **Quality assurance**: You verify dashboard functionality in a non-production environment.
- **Risk mitigation**: You minimize the risk of breaking production dashboards.

## Architecture

```text
...existing code block diagram from Scenario 2...
```

## Repository structure

```text
...existing structure block from Scenario 2...
```

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

## Alternatives

- Use branches: `develop` for development, `main` for production, both with `grafana/`.
- Use separate repositories for stricter isolation.

```

```
