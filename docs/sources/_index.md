---
aliases:
  - /docs/grafana/v1.1/
  - /docs/grafana/v3.1/
  - guides/reference/admin/
cascade:
  LOKI_VERSION: latest
  TEMPO_VERSION: latest
  ONCALL_VERSION: latest
  PYROSCOPE_VERSION: latest
description: Learn how to set up, configure, and use Grafana OSS and Grafana Enterprise, the self managed versions of the Grafana observability platform.
keywords:
  - grafana
  - get started
  - documentation
labels:
  products:
    - enterprise
    - oss
menuTitle: Grafana documentation
title: Grafana OSS and Enterprise
hero:
  title: Grafana OSS and Enterprise
  level: 1
  width: 100
  image: /media/docs/grafana-cloud/infrastructure/grafanalogo.svg
  height: 100
  description: The open and composable observability platform for people and AI agents. Monitor, understand, and act on your metrics, logs, traces, and profiles wherever they're stored.
cards:
  title_class: pt-0 lh-1
  items:
    - title: What's new
      href: ./whatsnew/
      description: Browse release highlights, deprecations, and breaking changes in Grafana releases.
      height: 24
    - title: Introduction
      href: ./fundamentals/
      description: Learn what Grafana is, the basics of observability, and how Grafana OSS, Grafana Enterprise, and Grafana Cloud differ.
      height: 24
    - title: Set up
      href: ./setup-grafana/
      description: Get up and running with Grafana.
      height: 24
    - title: Data sources
      href: ./datasources/
      description: Manage data sources and how to configure or query the built-in data sources.
      height: 24
    - title: Dashboards
      href: ./visualizations/dashboards/
      description: Query, transform, visualize, and understand your data no matter where it's stored.
      height: 24
    - title: Panels and Visualizations
      href: ./visualizations/panels-visualizations/
      description: Easily collect, correlate, and visualize data to make informed decisions in real-time.
      height: 24
    - title: Explore
      href: ./visualizations/explore/
      description: Explore your data using a query instead of creating a dashboard.
      height: 24
    - title: Alerting
      href: ./alerting/
      description: Learn about problems in your systems moments after they occur.
      height: 24
    - title: Grafana Assistant
      href: ./administration/assistant/
      description: Generate queries, create and edit dashboards, and navigate Grafana from natural language prompts in your self managed Grafana.
      height: 24
    - title: Administration
      href: ./administration/
      description: Perform administrative tasks such as configuring user management and roles and permissions.
      height: 24
    - title: Troubleshooting
      href: ./troubleshooting/
      description: Troubleshoot common Grafana issues.
      height: 24
    - title: Upgrade
      href: ./upgrade-guide/
      description: Upgrade Grafana to stay current with the latest fixes and enhancements.
      height: 24
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

Grafana is an open and composable observability platform. It brings together metrics, logs, traces, profiles, and other data from across your organization and gives people and AI agents the context they need to monitor, understand, and act on that data.

_Grafana Open Source Software (OSS)_ is the free, self managed version of Grafana. Grafana data source plugins enable you to query data sources including time series databases like Prometheus and CloudWatch, logging tools like Loki and Elasticsearch, NoSQL/SQL databases like Postgres, CI/CD tooling like GitHub, and many more. You can then display that data in live dashboards, explore it with ad hoc queries, alert on it, and work with it through [Grafana Assistant](./administration/assistant/) and the [Grafana MCP servers](https://grafana.com/docs/grafana-cloud/ai-tools/mcp-servers/).

_Grafana Enterprise_ is the commercial, self managed version of Grafana that includes exclusive data source plugins and additional features not found in the open source version. You also get full time support and training from the Grafana team.
To learn more about these features, refer to [Enterprise features](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/introduction/grafana-enterprise/#enterprise-features-in-grafana-cloud).

_Grafana Cloud_ is the fully managed Grafana observability platform, hosted by Grafana Labs, and includes a free tier. For more information, refer to the [Grafana Cloud documentation](https://grafana.com/docs/grafana-cloud/).

## Guidance and help

{{< guide name="whichgrafana" title="Which Grafana is right for you?" text="Answer a few questions and Grot will help you decide." >}}

## Learn

{{< card-grid key="cards" type="simple" >}}
