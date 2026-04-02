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
    - description: Overview of the Grafana Cloud CLI `gcx`, compatible with AI agents
      height: 24
      href: ./gcx
      title: gcx Cloud CLI
    - description: Learn how to install, set up and use the Grafana CLI `grafanactl`
      height: 24
      href: ./grafanactl
      title: grafanactl CLI
  title_class: pt-0 lh-1
title: Introduction to the Grafana CLIs
menuTitle: Grafana CLIs
weight: 100
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/grafana-cli/
aliases:
  - ../../observability-as-code/grafana-cli/ # /docs/grafana/next/observability-as-code/grafana-cli/
---

## Introduction to the Grafana CLIs

Grafana command-line tools are designed to simplify interaction with Grafana instances. You can authenticate, manage multiple environments, and perform administrative tasks through Grafana’s REST API, all from the terminal. Whether you're automating workflows in CI/CD pipelines or switching between staging and production environments, the Grafana CLIs provide a flexible and scriptable way to manage your Grafana setup efficiently.

Both `gcx` and `grafanactl` work across all environments for Grafana OSS, Enterprise, and Cloud.

## Explore

{{< card-grid key="cards" type="simple" >}}
