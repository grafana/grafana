---
_build:
  list: false
noindex: true
cascade:
  noindex: true
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
    - description: Learn how to install Grafana CLI
      height: 24
      href: ./install-grafana-cli/
      title: Install Grafana CLI
    - description: Set up Grafana CLI
      height: 24
      href: ./set-up-grafana-cli/
      title: Set up your Grafana CLI
    - description: Learn how to manage resources with Grafana CLI
      height: 24
      href: ./grafanacli-workflows
      title: Manage resources with Grafana CLI
  title_class: pt-0 lh-1
hero:
  description: Grafana CLI (`grafanactl`) is a command-line tool designed to simplify interaction with Grafana instances. It enables users to authenticate, manage multiple environments, and perform administrative tasks through Grafana’s REST API, all from the terminal. Whether you're automating workflows in CI/CD pipelines or switching between staging and production environments, Grafana CLI provides a flexible and scriptable way to manage your Grafana setup efficiently.
  height: 110
  level: 1
  title: Grafana CLI
  width: 110
title: Introduction to Grafana CLI
menuTitle: Grafana CLI
weight: 130
---

{{< docs/hero-simple key="hero" >}}

## Explore

{{< card-grid key="cards" type="simple" >}}
