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
title: Grafana Cloud CLI
weight: 500
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/grafanagcx
---

# Grafana Cloud CLI overview

{{< admonition type="caution" >}}

The Grafana Cloud CLI is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud and Grafana OSS/Enterprise v12 or later. Older Grafana versions are not supported.

**Grafana Cloud CLI is under development.** Documentation and support is available based on the different tiers but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}


The Grafana Cloud CLI `gcx` is a single CLI that allows you to manage both Grafana (dashboards, folders, alert rules, datasources) and Grafana Cloud products (SLOs, Synthetic Monitoring, OnCall, K6, Fleet Management, Incidents, Knowledge Graph, and Adaptive Telemetry).

It provides the following benefits:

- Manage Grafana & Grafana Cloud — one tool for dashboards, alerting, SLOs, on-call, synthetic checks, load testing, and more
- AI agent friendly — JSON/YAML output, structured errors, predictable exit codes. Agent mode auto-detected for Claude Code, Copilot, Cursor, and others
- GitOps — pull resources to files, version in git, push back with full round-trip fidelity
- Observability as code — scaffold Go projects, import existing dashboards, lint with Rego rules, live-reload dev server
- **Multi-environment:** Use named contexts to switch between dev, staging, and production environments.

For more information refer to the [`clx` repository](https://github.com/grafana/gcx) in GitHub.

