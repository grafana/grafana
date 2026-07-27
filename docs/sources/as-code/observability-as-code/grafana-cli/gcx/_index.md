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

{{< admonition type="caution" >}}

The Grafana CLI `gcx` is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud and Grafana OSS/Enterprise v12 or later. Older Grafana versions are not supported.

**`gcx` is under development.** Documentation and support is available based on the different tiers but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

`gcx` is a single CLI that allows you and your AI coding agent structured access to both Grafana (dashboards, folders, alert rules, data sources) and Grafana Cloud products such as Synthetic Monitoring, K6, Fleet Management, Incidents, or Adaptive Telemetry.

`gcx` ships with a suite of agent skills for common workflows like alert investigation, root-cause analysis, dashboard GitOps, SLO management, and observability setup. It natively supports agentic workflows and it's integrated with Grafana Assistant, combining the previously fragmented user experience into one single tool.

## Benefits of `gcx`

Among others, `gcx` provides the following benefits:

- **Manage Grafana OSS/Enterprise and Grafana Cloud:** Use a single tool for dashboards, alerting, SLOs, on-call, synthetic checks, load testing, and more.
- **GitOps**: Pull resources to files, version in Git, or push back with full round-trip fidelity.
- **SRE**: Ensure system performance by monitoring telemetry and root-causing incidents.
- **Observability as code:** `gcx` can scaffold Go projects, import existing dashboards, lint with Rego rules, or live-reload development servers.
- **Automation:** `gcx` uses JSON/YAML output, structured errors, and predictable exit codes.
- **Multi-environment:** Use named contexts to switch between development, staging, and production environments.
- **AI agent friendly:** Agent mode auto-detected for Claude Code, Copilot, Cursor, and other.

## Compatibility

`gcx` is compatible with any agentic coding tool.

`gcx` works across a wide range of Grafana product offerings. Feature availability depends on your Grafana deployment. For more information, refer to the [Compatibility matrix](https://github.com/grafana/gcx#compatibility).

## Migrate from `grafanactl`

If you want to migrate from `grafanctl` to `gcx`, search-and-replace `grafanactl` with `gcx`. For `grafanactl resources serve`, use `gcx dev serve` instead.

## Learn more

Refer to the [`gcx` repository](https://github.com/grafana/gcx) in GitHub for more information on:

- Installation and configuration
- How to manage resources, including dashboards-as-code
- CLI command reference
