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
title: Git Sync
menuTitle: Git Sync
weight: 300
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/
aliases:
  - ../../observability-as-code/provision-resources/intro-git-sync 
---

# Introduction to Git Sync

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud. Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided. You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

Git Sync is an [experimental feature](https://grafana.com/docs/release-life-cycle/) introduced in Grafana v12 for open source and Enterprise editions available in [nightly releases](https://grafana.com/grafana/download/nightly). Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided.

{{< /admonition >}}

**Git Sync** allows you to synchronize any new dashboards and changes to existing dashboards from the UI to your configured GitHub repository. If you push a change in the repository, those changes are mirrored in your Grafana instance. 

In the Git Sync workflow:

- When you provision resources with Git Sync you can modify them from within the Grafana UI or within the GitHub repository. Changes made in either the repository or the Grafana UI are bidirectional.
- Any changes made in the provisioned files stored in the GitHub repository are reflected in the Grafana database. By default, Grafana polls GitHub every 60 seconds. The Grafana UI reads from the database and updates the UI to reflect these changes.

For example, if you update a dashboard within the Grafana UI and click **Save** to preserve the changes, you'll be notified that the dashboard is provisioned in a GitHub repository. Next you'll be prompted to choose how to preserve the changes: either directly to a branch, or pushed to a new branch using a pull request in GitHub.

For more information, see [Introduction to Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/intro-git-sync) and [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/git-sync-setup).

## Provisioned folders and connections

The dashboards saved in your GitHub repository or local folder appear in Grafana in the 'provisioned' folder. The dashboards and folders saved to the local path are referred to as 'provisioned' resources and are labeled as such in the Grafana UI. You can update any provisioned dashboard that is either stored within a GitHub repository (Git Sync workflow) or in a local file (local file workflow).

You can set a single folder, or multiple folders to a different repository, with up to 10 connections. Alternatively, your entire Grafana instance can be the provisioned folder.

## Explore Git Sync

{{< section withDescriptions="true" depth="5" >}}
