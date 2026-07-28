---
description: Configuration guide for Grafana CLI, a command line tool for managing Grafana resources as code.
keywords:
  - configuration
  - Grafana Cloud CLI
  - CLI
  - command line
  - gcx
  - grafanactl
labels:
  products:
    - cloud
    - enterprise
    - oss
title: gcx CLI
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/grafanagcx
---

# Overview of the `gcx` CLI

`gcx` is a single CLI that allows you and your AI coding agent structured access to both Grafana (dashboards, folders, alert rules, data sources) and Grafana Cloud products such as Synthetic Monitoring, K6, Fleet Management, Incidents, or Adaptive Telemetry.

`gcx` ships with a suite of agent skills for common workflows like alert investigation, root-cause analysis, dashboard GitOps, SLO management, and observability setup. It natively supports agentic workflows and it's integrated with Grafana Assistant, combining the previously fragmented user experience into one single tool.

`gcx` is under continuous development. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

## Compatibility

The following applies:

- `gcx` is compatible with any agentic coding tool.

- `gcx` works across a wide range of Grafana product offerings. Feature availability depends on your Grafana deployment. For more information, refer to the [Compatibility matrix](https://github.com/grafana/gcx#compatibility).

- `gcx` is available for Grafana Cloud and Grafana OSS/Enterprise v12 or later, and older Grafana versions are not supported.

## Migrate from `grafanactl`

If you want to migrate from `grafanctl` to `gcx`, search-and-replace `grafanactl` with `gcx`. For `grafanactl resources serve`, use `gcx dev serve` instead.

## Learn more

Refer to the [`gcx` repository](https://github.com/grafana/gcx) in GitHub for more information on:

- Installation and configuration
- How to manage resources, including dashboards-as-code
- CLI command reference

## Explore

{{< card-grid key="cards" type="simple" >}}
