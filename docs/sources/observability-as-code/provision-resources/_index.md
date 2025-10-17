---
description: Learn about how to provision resources using Git Sync and local file provisioning administration.
keywords:
  - observability
  - configuration
  - as code
  - git integration
  - git sync
  - github
labels:
  products:
    - enterprise
    - oss
title: Provision resources and sync dashboards
menuTitle: Provision resources
weight: 300
---

# Provision resources and sync dashboards

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud. Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided. You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

Git Sync and local file provisioning are [experimental features](https://grafana.com/docs/release-life-cycle/) introduced in Grafana v12 for open source and Enterprise editions. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided.

{{< /admonition >}}

Provisioning allows you to configure how to store your dashboard JSON and other files in GitHub repositories using either Git Sync or a local path.

Of the two options, **Git Sync** is the favorited method for provisioning your dashboards. You can synchronize any new dashboards and changes to existing dashboards from the UI to your configured GitHub repository. If you push a change in the repository, those changes are mirrored in your Grafana instance. Refer to [Git Sync workflow](#git-sync-workflow) for more information.

Alternatively, **local file provisioning** allows you to include in your Grafana instance resources (such as folders and dashboard JSON files) that are stored in a local file system. Refer to [Local file workflow](#local-file-workflow) for more information.

## Provisioned folders and connections

The dashboards saved in your GitHub repository or local folder appear in Grafana in the 'provisioned' folder. The dashboards and folders saved to the local path are referred to as 'provisioned' resources and are labeled as such in the Grafana UI. You can update any provisioned dashboard that is either stored within a GitHub repository (Git Sync workflow) or in a local file (local file workflow).

You can set a single folder, or multiple folders to a different repository, with up to 10 connections. Alternatively, your entire Grafana instance can be the provisioned folder.

## Git Sync workflow

In the Git Sync workflow:

- When you provision resources with Git Sync you can modify them from within the Grafana UI or within the GitHub repository. Changes made in either the repository or the Grafana UI are bidirectional.
- Any changes made in the provisioned files stored in the GitHub repository are reflected in the Grafana database. By default, Grafana polls GitHub every 60 seconds. The Grafana UI reads from the database and updates the UI to reflect these changes.

For example, if you update a dashboard within the Grafana UI and click **Save** to preserve the changes, you'll be notified that the dashboard is provisioned in a GitHub repository. Next you'll be prompted to choose how to preserve the changes: either directly to a branch, or pushed to a new branch using a pull request in GitHub.

For more information, see [Introduction to Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/intro-git-sync) and [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/git-sync-setup).

## Local file workflow

In the local file workflow:

- All provisioned resources are changed in the local files.
- Any changes made in the provisioned files are reflected in the Grafana database. The Grafana UI reads the database and updates the UI to reflect these changes.
- You can't use the Grafana UI to edit or delete provisioned resources.

Learn more in [Set up file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/file-path-setup/).

## Explore provisioning

{{< section withDescriptions="true" depth="5" >}}
