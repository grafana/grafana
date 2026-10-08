---
description: Guide for upgrading to Grafana v13.3
keywords:
  - grafana
  - configuration
  - documentation
  - upgrade
  - '13.3'
title: Upgrade to Grafana v13.3
menuTitle: Upgrade to v13.3
weight: 492
---

# Upgrade to Grafana v13.3

{{< docs/shared lookup="upgrade/intro_2.md" source="grafana" version="<GRAFANA_VERSION>" >}}

{{< docs/shared lookup="back-up/back-up-grafana.md" source="grafana" version="<GRAFANA_VERSION>" leveloffset="+1" >}}

{{< docs/shared lookup="upgrade/upgrade-common-tasks.md" source="grafana" version="<GRAFANA_VERSION>" >}}

## Technical notes

### Memory limits for backend plugin processes

Grafana v13.2 moved several data sources out of the Grafana server binary into separate backend plugin processes.
Prometheus is one of them.
Each process has its own Go runtime and its own heap.

A plugin process doesn't inherit `GOMEMLIMIT` or `GOGC` from the Grafana server environment.
A `GOMEMLIMIT` set on the container or service applies to the Grafana server process only, and plugin processes run without a memory limit.
To set a limit for every plugin process, use `default_memory_limit` in the `[plugins]` section.
To set a limit for one plugin, use `memory_limit` in its `[plugin.<plugin_id>]` section.
To pass the server's `GOMEMLIMIT` and `GOGC` to every plugin process instead, set `forward_go_runtime_env_vars` to `true`.

Size the container for the Grafana server plus each backend plugin process.
For more information, refer to [`default_memory_limit`](../../setup-grafana/configure-grafana/#default_memory_limit) and [`memory_limit`](../../setup-grafana/configure-grafana/#memory_limit).
