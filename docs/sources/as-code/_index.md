---
aliases:
description: Deploy, configure and provision Grafana with as-code workflows.
menuTitle: As code
title: Deploy, configure and provision Grafana with as-code workflows
hero:
  title: Configure and provision Grafana with as-code workflows
  level: 1
  width: 100
  height: 100
  description: Manage resources, including folders and dashboards, and configurations with as-code workflows.
cards:
  items:
    - description: Using Observability as code, you can version, automate, and scale Grafana configurations, including dashboards and observability workflows.
      height: 24
      href: ./observability-as-code/
      title: Observability as code
    - description: Using Infrastructure as code, you can declaratively manage what Grafana resources to use.
      height: 24
      href: ./infrastructure-as-code/
      title: Infrastructure as code
weight: 850
canonical: https://grafana.com/docs/grafana/latest/as-code/
---

{{< docs/hero-simple key="hero" >}}

---

## Overview

**Observability as code** lets you apply code management best practices to your observability resources. By representing Grafana resources as code, you can integrate them into existing infrastructure-as-code workflows and apply standard development practices. Instead of manually configuring dashboards or settings through the Grafana UI, you can:

- Write configurations in code: Define dashboards in JSON or other supported formats.
- Sync your Grafana setup to GitHub: Track changes, collaborate, and roll back updates using Git and GitHub, or other remote sources.
- Automate with CI/CD: Integrate Grafana directly into your development and deployment pipelines.
- Standardize workflows: Ensure consistency across your teams by using repeatable, codified processes for managing Grafana resources.

In Grafana Cloud, you can use **Infrastructure as code** to declaratively create and manage dashboards via configuration files in source code, and incorporate them efficiently into your own use cases. This enables you to review code, reuse it, and create better workflows. Infrastructure as code tools include Terraform, Ansible, the Grafana Operator, and Grizzly.

## Explore

{{< card-grid key="cards" type="simple" >}}
