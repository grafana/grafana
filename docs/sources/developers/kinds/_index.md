---
title: Grafana schema
weight: 200
_build:
  list: false
---

# Grafana schema

> Grafana’s schemas, kind system and related code generation are in active development.

Grafana is moving to a schema-centric model of development, where schemas are the single source of truth that specify
the shape of objects - for example, dashboards, datasources, users - in the frontend, backend, and plugin code.
Eventually, all of Grafana’s object types will be schematized within the “Kind System.” Kinds, their schemas, the Kind
system rules, and associated code generators will collectively provide a clear, consistent foundation for Grafana’s
APIs, documentation, persistent storage, clients, as-code tooling, and so forth.

It’s exciting to imagine the possibilities that a crisp, consistent development workflow will enable - this is why
companies build [developer platforms](https://internaldeveloperplatform.org/)! At the same time, it’s also
overwhelming - any schema system that can meet Grafana’s complex requirements will necessarily have a lot of moving
parts. Additionally, we must account for having Grafana continue to work as we make the transition - a prerequisite
for every large-scale refactoring.

In the Grafana ecosystem, there are three basic Kind categories and associated schema categories:
- [Core Kinds]({{< relref "core/" >}})
- Custom Kinds
- [Composable Kinds]({{< relref "composable/" >}})

The schema authoring workflow for each varies, as does the path to maturity. 
[Grafana Kinds - From Zero to Maturity]({{< relref "maturity/" >}}) contains general reference material applicable to 
all Kind-writing, and links to the guides for each category of Kind. 
