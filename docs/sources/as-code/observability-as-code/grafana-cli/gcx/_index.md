---
description: Configuration guide for Grafana CLI, a command line tool for managing Grafana resources as code.
keywords:
  - configuration
  - Grafana Cloud CLI
  - CLI
  - command line
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

**The `gcx` CLI is under development.** Documentation and support is available based on the different tiers but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

The Grafana Cloud CLI `gcx` is a single CLI that allows you to manage both Grafana (dashboards, folders, alert rules, data sources) and Grafana Cloud products such as Synthetic Monitoring, K6, Fleet Management, Incidents, or Adaptive Telemetry. `gcx` natively supports agentic workflows and is integrated with Grafana Assistant, to combine the previously fragmented user experience in one tool 

It provides the following benefits:

- **Manage Grafana on-prem and Grafana Cloud:** Use a single tool for dashboards, alerting, SLOs, on-call, synthetic checks, load testing, and more.
- **AI agent friendly:** Agent mode auto-detected for Claude Code, Copilot, Cursor, and other.
- **Automation:** `gcx` uses JSON/YAML output, structured errors, and predictable exit codes.
- **GitOps**: Pull resources to files, version in Git, or push back with full round-trip fidelity.
- **Observability as code:** `gcx` can scaffold Go projects, import existing dashboards, lint with Rego rules, or live-reload development servers.
- **Multi-environment:** Use named contexts to switch between development, staging, and production environments.

## Learn more

Refer to the [`clx` repository](https://github.com/grafana/gcx) in GitHub for more information on:

- Installation and configuration
- How to managing resources, including dashboards-as-code
- CLI command reference
