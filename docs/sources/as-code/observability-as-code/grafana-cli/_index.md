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
  - github
labels:
  products:
    - cloud
    - enterprise
    - oss
cards:
  items:
    - description: Learn how to install and set up the Grafana CLI `grafanactl`
      height: 24
      href: ./install-grafana-cli/
      title: Install and set up grafanactl
    - description: Learn how to manage resources with `grafanactl`
      height: 24
      href: ./grafanacli-workflows
      title: Manage resources with grafanactl
    - description: Overview of the Grafana Cloud CLI `gcx`, compatible with AI agents
      height: 24
      href: ./grafanagcx
      title: Grafana Cloud CLI
  title_class: pt-0 lh-1
hero:
  description: The `grafanactl` and `gcx` command-line tools are designed to simplify interaction with Grafana instances. You can authenticate, manage multiple environments, and perform administrative tasks through Grafana’s REST API, all from the terminal. Whether you're automating workflows in CI/CD pipelines or switching between staging and production environments, the Grafana CLIs provide a flexible and scriptable way to manage your Grafana setup efficiently. Both `grafanactl` and `gcx` work across all environments for Grafana OSS, Enterprise, and Cloud.
  height: 110
  level: 1
  title: Grafana CLI
  width: 110
title: Introduction to the Grafana CLIs
menuTitle: Grafana CLI
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/
aliases:
  - ../../observability-as-code/grafana-cli/ # /docs/grafana/next/observability-as-code/grafana-cli/
---

{{< docs/hero-simple key="hero" >}}

## Explore

{{< card-grid key="cards" type="simple" >}}
