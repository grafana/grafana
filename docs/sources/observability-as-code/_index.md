---
_build:
  list: false
noindex: true
cascade:
  noindex: true
description: Overview of Observability as Code including description, key features, and explanation of benefits.
keywords:
  - observability
  - configuration
  - as code
  - dashboards
  - git integration
  - git sync
  - github
labels:
  products:
    - enterprise
    - oss
title: Observability as Code
weight: 100
---

# Observability as Code

Observability as Code lets you apply code management best practices to your observability resources.
Using Observability as Code, you can version, automate, and scale Grafana configurations, including dashboards and observability workflows.
By representing Grafana resources as code, you can integrate them into existing infrastructure-as-code workflows and apply standard development practices.

Observability as Code provides more control over configuration. Instead of manually configuring dashboards or settings through the Grafana UI, you can:

- **Write configurations in code:** Define dashboards in JSON or other supported formats.
- **Sync your Grafana setup to GitHub:** Track changes, collaborate, and roll back updates using Git and GitHub, or other remote sources.
- **Automate with CI/CD:** Integrate Grafana directly into your development and deployment pipelines.
- **Standardize workflows:** Ensure consistency across your teams by using repeatable, codified processes for managing Grafana resources.

{{< section depth=5 >}}

<!-- Hiding this part of the doc because the rest of the docs aren't released yet

## Key features

At this time, Observability as Code lets you configure dashboards in static files rather than using the UI.
The number of resources covered by this approach will expand over time.

### App Platform: A unified foundation

The [App Platform](https://github.com/grafana/grafana-app-sdk) is the backbone of Observability as Code. It provides consistent APIs for managing Grafana resources like dashboards, data sources, and service-level objectives (SLOs). With the App Platform, you gain:

- A stable and predictable API for integrating Grafana into your systems.
- Support for cloud-native workflows, making it easier to build and scale observability solutions.
- The ability to manage Grafana resources programmatically.
- Backwards compatibility with earlier versions of Grafana APIs, so older applications still work.

### Git integration

Version control is at the heart of Observability as Code. By integrating Grafana with Git, you can:

- Store your dashboards in a Git repository.
- Automatically deploy changes through CI/CD pipelines.
- Track who made changes, when they were made, and why.

### Enhanced dashboard management

Dashboards are central to Grafana’s value, and Observability as Code introduces improvements to make them easier to work with:

- **Ready for Schema v2:** An experimental dashboard schema that simplifies dashboards definition, separating properties for better clarity and making configurations more intuitive.
- **New layout options:** Flexible layouts, including a new responsive grid layout that allow for more dynamic and responsive panel layouts.
- **Improved metadata management:** Add descriptions, tags, and other metadata to better organize and understand your dashboards.

### Tooling and integrations

Observability as Code comes with tools to make your workflows seamless:

- Examples and best practices for integrating Grafana with tools like Terraform, Kubernetes, and GitHub Actions.
- The Foundation SDK provides a set of libraries for getting started quickly configuring and manipulating Grafana resources.
- A command line tool for configuring your dashboards programmatically.
- Documentation, videos, and SDKs to help you get started quickly.
-->
