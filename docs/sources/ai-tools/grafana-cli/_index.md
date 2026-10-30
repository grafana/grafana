---
description: Overview of Grafana CLI, a command line tool for managing Grafana resources as code.
keywords:
  - observability
  - configuration
  - as code
  - as-code
  - dashboards
  - git integration
  - git sync
  - CLI
  - gcx
labels:
  products:
    - cloud
    - enterprise
    - oss
cards:
  items:
    - description: Learn how to use gcx, the Grafana CLI compatible with AI agents
      height: 24
      href: ./gcx
      title: gcx
    - description: Learn how to install, set up and use the Grafana CLI `grafanactl`
      height: 24
      href: ./grafanactl
      title: grafanactl CLI (deprecated)
  title_class: pt-0 lh-1
title: Introduction to the Grafana CLI tools
menuTitle: gcx CLI
weight: 100
canonical: https://grafana.com/docs/grafana/latest/ai-tools/grafana-cli/
aliases:
  - ../as-code/observability-as-code/grafana-cli/
  - ../observability-as-code/grafana-cli/
---

# Introduction to the Grafana CLI tools

Grafana command-line tools are designed to simplify interaction with Grafana instances. You can authenticate, manage multiple environments, and perform administrative tasks through the Grafana REST API, all from the terminal. Whether you're automating workflows in CI/CD pipelines or switching between staging and production environments, the Grafana CLI tools provide a flexible and efficient way to manage your Grafana setup as code.

`gcx` works across all environments for Grafana OSS, Enterprise, and Cloud. **Use `gcx` to work with AI agents**.

## Explore

{{< card-grid key="cards" type="simple" >}}
