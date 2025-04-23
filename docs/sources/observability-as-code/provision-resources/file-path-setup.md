---
description: Instructions for setting up file provisioning with a local path.
keywords:
  - as code
  - as-code
  - file provisioning
  - local path
labels:
  products:
    - enterprise
    - oss
title: Set up file provisioning
weight: 200
---

# Set up file provisioning

{{< admonition type="note" >}}
Local file provisioning is an [experimental feature](https://grafana.com/docs/release-life-cycle/) introduced in Grafana v12 for open source and Enterprise editions. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided. Enable the `provisioning` and `kubernetesDashboards` feature toggles in Grafana to use this feature. This feature isn't available in Grafana Cloud.
{{< /admonition >}}

- [Provision resources and sync dashboards](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/)
  - [Git Sync](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/intro-git-sync/)
  - [Set up Git Sync](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/git-sync-setup/)
  - [Set up file provisioning](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/file-path-setup/)
  - [Work with provisioned dashboards](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/provisioned-dashboards/)
  - [Manage provisioned repositories with Git Sync](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/use-git-sync/)

<hr />

File provisioning in Grafana lets you include resources, including folders and dashboard JSON files, that are stored in a local file system.

This page explains how to set up local file provisioning.

The local path mount is referred to as a repository.

Using the local path lets you also use it with a tool like `fuse`, allowing you to mount S3 buckets as local paths. You can also use tools like `restic` to automatically back up your dashboards to your preferred backup storage solution.

To set up file sync with local with local files, you need to:

1. Enable feature toggles and paths in Grafana configuration file (first time set up).
1. Set the local path.
1. Choose what content to sync with Grafana.

## New file provisioning capabilities

Local file provisioning using **Administration** > **Provisioning** will eventually replace the traditional methods Grafana has used for referencing local file systems for dashboard files.

{{< admonition type="note" >}}
For production system, we recommend using the `folderFromFilesStructure` capability instead of **Administration** > **Provisioning** to include dashboards from a local file system in your Grafana instance.
Refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#provision-folders-structure-from-filesystem-to-grafana) for more information.
{{< /admonition >}}

### Limitations

- A provisioned dashboard can't be deleted from within Grafana UI. The dashboard has to be deleted at the local file system and those changes synced to Grafana.
- Changes from the local file system are one way: you can't save changes from

## Before you begin

To set up file provisioning, you need:

- Administration rights in your Grafana organization.
- A local directory where your dashboards will be stored.
  - If you want to use a GitHub repository, refer to [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/file-path-setup/).
- To update the `permitted_provisioning_paths` section of `custom.ini`.
- To enable the required feature toggles in your Grafana instance.

## Enable required feature toggles and configure permitted paths

To activate local file provisioning in Grafana, you need to enable the `provisioning` and `kubernetesDashboards` feature toggles.
For additional information about feature toggles, refer to [Configure feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles).

The local setting must be a relative path and its relative path must be configured in the `permitted_provisioned_paths` configuration option.
The configuration option is relative to your working directory, i.e. where you are running Grafana from; this is usually `/usr/share/grafana` or similar.

Local file paths can point to any directory that is permitted by the configuration.
The default paths is `devenv/dev-dashboards` and `conf/provisioning` in your `grafana` installation directory.

The path must behave as a standard file directory on the system of choice.
Any subdirectories are automatically included.

The values that you enter for the `permitted_provisioning_paths` become the base paths for those entered when you enter a local path in the **Connect to local storage** wizard.

1. Open your Grafana configuration file, either `grafana.ini` or `custom.ini`. For file location based on operating system, refer to [Configuration file location](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/#experimental-feature-toggles).
1. Locate or add a `[feature_toggles]` section. Add these values:

   ```ini
   [feature_toggles]
   provisioning = true
   kubernetesDashboards = true ; use k8s from browser

   # If you want easy kubectl setup development mode
   grafanaAPIServerEnsureKubectlAccess = true
   ```

1. Locate or add a `[paths]` section. To add more than one location, use the pipe character (`|`) to separate the paths. The list should not include empty paths or trailing pipes. Add these values:

   ```ini
   [paths]
   ; This is devenv/dev-dashboards and conf/provisioning by default.
   permitted_provisioning_paths = grafana/ | /etc/grafana/provisioning/
   ```

1. Save the changes to the file and start Grafana.

## Set up file-based provisioning

To use file-based provisioning, you need the file path to the `grafana` folder where your dashboards are stored in the repository.

To start setting up file-based provisioning:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration** in the left-side menu and then **Provisioning**.
1. Select [Configure file provisioning](#set-up-file-based-provisioning).

### Connect to local storage

The local path can point to any directory that is permitted by the configuration.
Refer to [Enabled required feature toggles and paths](#enable-required-feature-toggles-and-configure-permitted-paths) for information.

The starting path is always your working `grafana` directory.
The prefix that must be entered is determined by the locations configured in `permitted_provisioning_paths`.
The default paths are `devenv/dev-dashboards` and `conf/provisioning` in your `grafana` installation directory.
The value you enter in the Grafana UI must _begin_ with any of the configured values. For example, `conf/provisioning/test` is valid, but `conf/test` is not.

1. Enter the **Local path**, for example `grafana/`. This must begin with any of the configured `permitted_provisioned_paths`.
1. Select **Choose what to synchronize**.

The set up process verifies the path and provides an error message if a problem occurs.

### Choose what to synchronize

In this section, you determine the actions taken with the storage you selected.

1. Select how resources should be handled in Grafana.

- Choose **Sync all resources with external storage** if you want to sync and manage your entire Grafana instance through external storage. You can only have one provisioned connection with this selection.
- Choose **Sync external storage to new Grafana folder** to sync external resources into a new folder without affecting the rest of your instance. You can repeat this process for up to 10 folders. - Enter a **Display name** for the repository connection. Resources stored in this connection appear under the chosen display name in the Grafana UI.
<!--  - Select **Migrate instance to repository** to migrate the Grafana instance to the repository. This option is not available during the first time you set up remote provisioning. -->

1. Select **Synchronize** to continue.

### Synchronize with external storage

After this one time step, all future updates are automatically saved to the local file path and provisioned back to the instance.

During the initial synchronization, your dashboards will be temporarily unavailable. No data or configurations will be lost.
How long the process takes depends upon the number of resources involved.

Select **Begin synchronization** to start the process.

### Choose additional settings

If you wish, you can make any files synchronized as as **Read only** so no changes can be made to the resources through Grafana.
Any resources made outside of Grafana and saved to the local repository will be reflected in Grafana.

Select **Finish**.

## Verify your dashboards in Grafana

To verify that your dashboards are available at the location that you specified, click **Dashboards**. The name of the dashboard is listed in the **Name** column.
