---
_build:
  list: false
noindex: true
cascade:
  noindex: true
description: Learn more about the supported workflows and use cases for Grafana CLI
keywords:
  - workflows
  - Grafana CLI
  - CLI
  - command line
  - grafanactl
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Manage resources with Grafana CLI
weight: 300
---

# Manage resources with Grafana CLI

{{< admonition type="note" >}}
`grafanactl` is under active development. Command-line flags and subcommands described here may change. This document outlines the target workflows the tool is expected to support.
{{< /admonition >}}

## Migrate resources between environments

Using the `config` and `resources` options, you can migrate Grafana resources from one environment to another, for example, from a development to production environment.
The `config` option lets you define the configuration context.
Using `resources` with `pull`, `push`, and `serve` lets you pull a defined resource from one instance, and push that resource to another instance. `Serve` allows you to preview changes locally before pushing.

Use these steps to migrate resources between environments:

{{< admonition type="note" >}}
Currently, the `serve` command only works with dashboards.
{{< /admonition >}}

Use these steps to migrate resources between environments:

{{< admonition type="note" >}}
Resources are pulled and pushed from the `./resources` directory by default.
This directory can be configured with the `--directory`/`-d` flags.
{{< /admonition >}}

1. Make changes to dashboards and other resources using the Grafana UI in your **development instance**.
1. Pull those resources from the development environment to your local machine:

   ```bash
   grafanactl config use-context YOUR_CONTEXT  # for example "dev"
   grafanactl resources pull -d ./resources/ -o yaml  # or json
   ```

1. (Optional) Preview the resources locally before pushing:

   ```bash
   grafanactl config use-context YOUR_CONTEXT  # for example "prod"
   grafanactl resources serve -d ./resources/
   ```

1. Switch to the **production instance** and push the resources:

   ```bash
   grafanactl config use-context YOUR_CONTEXT  # for example "prod"
   grafanactl resources push -d ./resources/
   ```

## Back up Grafana resources

This workflow helps you back up all Grafana resources from one instance and later restore them. This is useful to replicate a configuration or perform disaster recovery.

1. Use `grafanactl` to pull all resources from your target environment:

   ```bash
   grafanactl config use-context YOUR_CONTEXT  # for example "prod"
   grafanactl resources pull -d ./resources/ -o yaml  # or json
   ```

1. Save the exported resources to version control or cloud storage.

## Restore Grafana resources

1. (Optional) Preview the backup locally:

   ```bash
   grafanactl config use-context YOUR_CONTEXT  # for example "prod"
   grafanactl resources serve -d ./resources/
   ```

1. To restore the resources later or restore them on another instance, push the saved resources:

   ```bash
   grafanactl config use-context YOUR_CONTEXT  # for example "prod"
   grafanactl resources push -d ./resources/
   ```

## Manage dashboards as code

With this workflow, you can define and manage dashboards as code, saving them to a version control system like Git. This is useful for teams that want to maintain a history of changes, collaborate on dashboard design, and ensure consistency across environments.

1. Use a dashboard generation script (for example, with the [Foundation SDK](https://github.com/grafana/grafana-foundation-sdk)). You can find an example implementation in the Grafana as code [hands-on lab repository](https://github.com/grafana/dashboards-as-code-workshop/tree/main/part-one-golang).

1. Serve and preview the output of the dashboard generator locally:

   ```bash
   grafanactl config use-context YOUR_CONTEXT  # for example "dev"
   grafanactl resources serve --script 'go run scripts/generate-dashboard.go' --watch './scripts'
   ```

1. When the output looks correct, generate dashboard manifest files:

   ```bash
   go run scripts/generate-dashboard.go --generate-resource-manifests --output './resources'
   ```

1. Push the generated resources to your Grafana instance:

   ```bash
   grafanactl config use-context YOUR_CONTEXT  # for example "dev"
   grafanactl resources push -d ./resources/
   ```

## Explore and modify resources from the terminal

This section describes how to use the Grafana CLI to interact with Grafana resources directly from your terminal. These commands allow you to browse, inspect, update, and delete resources without using the Grafana UI. This approach is useful for advanced users who want to manage resources more efficiently or integrate Grafana operations into automated workflows.

### Find and delete dashboards using invalid data sources

Use this workflow to identify dashboards that reference incorrect or outdated data sources, and remove them if necessary.

1. Set the context to the appropriate environment:

   ```bash
   grafanactl config use-context YOUR_CONTEXT  # for example "prod"
   ```

1. Find dashboards using specific data sources:

   ```bash
   grafanactl resources get dashboards -ojson | jq '.items | map({ uid: .metadata.name, datasources: .spec.panels | map(.datasource.uid)  })'
   [
      {
         "uid": "important-production-dashboard",
         "datasources": [
            "mimir-prod"
         ]
      },
      {
         "uid": "test-dashboard-from-dev",
         "datasources": [
            "mimir-prod",
            "mimir-dev"
         ]
      },
      {
         "uid": "test-dashboard-from-stg",
         "datasources": [
            "mimir-prod",
            "mimir-stg",
            "mimir-dev"
         ]
      }
   ]
   ```

   This command lists dashboard UIDs along with the data source UIDs used in their panels. You can then identify the dashboards that are using invalid or unexpected data sources.

1. Delete the identified dashboards directly:

   ```bash
   grafanactl resources delete dashboards/test-dashboard-from-stg,test-dashboard-from-dev
   ✔ 2 resources deleted, 0 errors
   ```

### Find and deprecate dashboards using the old API version

Use this workflow to locate dashboards using a deprecated API version and mark them accordingly.

1. Set the context to the appropriate environment:

   ```bash
   grafanactl config use-context YOUR_CONTEXT  # for example "prod"
   ```

1. List all available resources types and versions:

   ```bash
   grafanactl resources list
   ```

   This command returns a list of resources, including their versions, types, and quantities:

   ```bash
   GROUP                               VERSION   KIND
   folder.grafana.app                  v1        folder
   dashboard.grafana.app               v1        dashboard
   dashboard.grafana.app               v1        librarypanel
   dashboard.grafana.app               v2        dashboard
   dashboard.grafana.app               v2        librarypanel
   playlist.grafana.app                v1        playlist
   ```

1. Find dashboards that are still using an old API version:

   ```bash
   grafanactl resources get dashboards.v1.dashboard.grafana.app
   ```

   This command returns a table displaying the resource type, resource name, and associated namespace:

   ```bash
   KIND         NAME                                   NAMESPACE
   dashboards   really-old-dashboard                   default
   ```

1. Edit each of these dashboards to add a `deprecated` tag:

   ```bash
   grafanactl resources edit dashboards.v1.dashboard.grafana.app/really-old-dashboard -p '{"spec":{"tags":["deprecated"]}}'
   ```

{{< admonition type="tip" >}}
You can get help by using the `grafanactl --help` command.
{{< /admonition >}}
