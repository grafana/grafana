---
description: Instructions for setting up file provisioning with a local path, using the UI or as code.
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
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/file-path-setup/
aliases:
  - ../../../observability-as-code/provision-resources/file-path-setup/ # /docs/grafana/next/observability-as-code/provision-resources/file-path-setup/
---

# Set up file provisioning

{{< admonition type="note" >}}

On-prem file provisioning is available in Grafana v12 and later for open source and Enterprise editions. It's **not available in Grafana Cloud**. This new file provisioning feature is only available for dashboards and doesn't replace classic provisioning for the time being.

For classic provisioning using configuration files refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/).

{{< /admonition >}}

Use local file provisioning to include in your Grafana instance resources that you store in your local file system.

The local path mount is referred to as a `repository`. File provisioning uses the same `Repository` resource as [Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/), with the repository `type` set to `local` and a `path` that points to a directory on the Grafana server's file system.

Using the local path lets you also use it with a tool like `fuse`, allowing you to mount S3 buckets as local paths. You can also use tools like `restic` to automatically back up your dashboards to your preferred backup storage solution.

You can set up file provisioning in two ways:

- [Using the UI](#set-up-file-provisioning-using-the-ui) through **Administration** > **Provisioning**.
- [As code](#set-up-file-provisioning-as-code) with `gcx`, the Grafana CLI, so you can manage the configuration in a GitOps-style workflow.

Both approaches require you to first [configure the permitted paths](#configure-permitted-paths) in the Grafana configuration file.

{{< admonition type="note" >}}

The UI refers to this feature as _file provisioning_ and to the storage location as _local storage_. In the `Repository` resource, the corresponding repository `type` value is `local` and the path is set in `spec.local.path`.

{{< /admonition >}}

## New file provisioning capabilities

Local file provisioning using **Administration** > **Provisioning** will eventually replace the traditional methods Grafana has used for referencing local file systems for dashboard files.

{{< admonition type="note" >}}
For production systems, use the `folderFromFilesStructure` capability instead of **Administration** > **Provisioning** to include dashboards from a local file system in your Grafana instance. Refer to [Provision Grafana](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/provisioning/#provision-folders-structure-from-filesystem-to-grafana) for more information.
{{< /admonition >}}

## Before you begin

To set up file provisioning, you need:

- Administration rights in your Grafana organization.
- A local directory to store your dashboards. If you want to use a GitHub repository, refer to [Set up Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/git-sync-setup/).
- To update the `permitted_provisioning_paths` section of `custom.ini`.
- To understand the limitations of local file provisioning. Refer to [How it works](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources#how-it-works) for more details.
- To set up file provisioning as code, you also need `gcx` configured with your Grafana instance details. Refer to the [Grafana CLI documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/) for setup instructions.

## Configure permitted paths

The `provisioning` feature toggle is enabled by default in Grafana Cloud and, starting in Grafana v13, for OSS and Enterprise as well. No manual configuration of the feature toggle is required.

The local setting must be a relative path and its relative path must be configured in the `permitted_provisioned_paths` configuration option.
The configuration option is relative to your working directory, i.e. where you are running Grafana from; this is usually `/usr/share/grafana` or similar.

Local file paths can point to any directory that is permitted by the configuration.
The default paths is `devenv/dev-dashboards` and `conf/provisioning` in your `grafana` installation directory.

The path must behave as a standard file directory on the system of choice.
Any subdirectories are automatically included.

The values that you enter for the `permitted_provisioning_paths` become the base paths for those entered when you enter a local path in the **Connect to local storage** wizard or in the `spec.local.path` field of a `Repository` resource.

1. Open your Grafana configuration file, either `grafana.ini` or `custom.ini`. For file location based on operating system, refer to [Configuration file location](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/).
1. Locate or add a `[paths]` section. To add more than one location, use the pipe character (`|`) to separate the paths. The list should not include empty paths or trailing pipes. Add these values:

   ```ini
   [paths]
   ; This is devenv/dev-dashboards and conf/provisioning by default.
   permitted_provisioning_paths = grafana/ | /etc/grafana/provisioning/
   ```

1. Save the changes to the file and start Grafana.

## Set up file provisioning using the UI

To use file-based provisioning, you need the file path to the `grafana` folder where your dashboards are stored in the repository.

To start setting up file-based provisioning:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration** in the left-side menu and then **Provisioning**.
1. Select [Configure file provisioning](#set-up-file-provisioning-using-the-ui).

### Connect to local storage

The local path can point to any directory that is permitted by the configuration.
Refer to [Configure permitted paths](#configure-permitted-paths) for information.

The starting path is always your working `grafana` directory.
The prefix that must be entered is determined by the locations configured in `permitted_provisioning_paths`.
The default paths are `devenv/dev-dashboards` and `conf/provisioning` in your `grafana` installation directory.
The value you enter in the Grafana UI must _begin_ with any of the configured values. For example, `conf/provisioning/test` is valid, but `conf/test` is not.

1. Enter the **Local path**, for example `grafana/`. This must begin with any of the configured `permitted_provisioned_paths`.
1. Select **Choose what to synchronize**.

The set up process verifies the path and provides an error message if a problem occurs.

### Choose what to synchronize

#### Synchronization limitations

To have access to full instance sync you must explicitly enable the option.

The following applies:

- You won't be able to create new alerts or library panels after setup is completed.
- If you opted for full instance sync and want to use alerts and library panels, you'll have to delete the provisioned repository and connect again with folder sync.

#### Set up synchronization

You can sync external resources into a new folder without affecting the rest of your instance.

To set up synchronization:

1. Select which resources you want to sync.

1. Enter a **Display name** for the repository connection. Resources stored in this connection appear under the chosen display name in the Grafana UI.

1. Click **Synchronize** to continue.

1. You can repeat this process for up to 10 connections.

{{< admonition type="note" >}}

Optionally, you can export any unmanaged resources into the provisioned folder. See how in [Synchronize with external storage](#synchronize-with-external-storage).

{{< /admonition >}}

### Synchronize with external storage

In this step you proceed to synchronize the resources selected in the previous step. Optionally, you can check the **Migrate existing resources** box to migrate your unmanaged dashboards to the provisioned folder.

Select **Begin synchronization** to start the process. After this one time step, all future updates are automatically saved to the local file path and provisioned back to the instance.

Note that during the initial synchronization, your dashboards will be temporarily unavailable. No data or configurations will be lost.
How long the process takes depends upon the number of resources involved.

### Choose additional settings

If you wish, you can make any files synchronized as as **Read only** so no changes can be made to the resources through Grafana.
Any resources made outside of Grafana and saved to the local repository will be reflected in Grafana.

Select **Finish**.

## Set up file provisioning as code

Because file provisioning is managed as code using the same `Repository` Custom Resource Definition (CRD) as Git Sync, you can define it in a YAML file and push it to Grafana with `gcx`. This approach enables automated, GitOps-style workflows for managing file provisioning instead of using the Grafana UI.

To set up file provisioning as code with `gcx`, follow these steps:

1. [Create the repository resource](#create-the-repository-resource).
1. [Push the resource to Grafana](#push-the-resource-to-grafana).
1. [Manage the repository resource](#manage-the-repository-resource).
1. [Verify your dashboards in Grafana](#verify-your-dashboards-in-grafana).

### Create the repository resource

Create a `repository.yaml` file defining your file provisioning configuration. Set the repository `type` to `local` and use `spec.local.path` for the directory that holds your dashboards.

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: '<REPOSITORY_NAME>'
spec:
  title: '<REPOSITORY_TITLE>'
  type: local
  local:
    path: '<LOCAL_PATH>'
  sync:
    enabled: true
    intervalSeconds: 60
    target: folder
  workflows:
    - write
```

Replace the placeholders with your values:

- _`<REPOSITORY_NAME>`_: Unique identifier for this repository resource
- _`<REPOSITORY_TITLE>`_: Human-readable name displayed in the Grafana UI
- _`<LOCAL_PATH>`_: Path to the directory that holds your dashboards. It must begin with one of the configured `permitted_provisioning_paths`, for example `grafana/`.

{{< admonition type="note" >}}

File provisioning supports two sync targets: `target: folder` (the default) creates a folder named after the repository and places synced resources inside it, while `target: folderless` places synced resources at the top level without creating a wrapper folder. Refer to [Sync targets](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/key-concepts/#sync-targets) for details.

{{< /admonition >}}

### Configuration parameters

The following configuration parameters are available:

| Field                       | Description                                                                    |
| --------------------------- | ------------------------------------------------------------------------------ |
| `metadata.name`             | Unique identifier for this repository resource                                 |
| `spec.title`                | Human-readable name displayed in the Grafana UI                                |
| `spec.type`                 | Repository type. Set to `local` for file provisioning                          |
| `spec.local.path`           | Path to the directory that holds your dashboards, within a permitted path      |
| `spec.sync.enabled`         | Enable synchronization (true/false)                                            |
| `spec.sync.intervalSeconds` | Sync interval in seconds                                                       |
| `spec.sync.target`          | Where to place synced dashboards (`folder` or `folderless`)                    |
| `spec.workflows`            | Enabled workflows: `write` (direct changes). Leave empty for a read-only mount |

### Push the resource to Grafana

Before pushing any resources, configure `gcx` with your Grafana instance details. Refer to the [Grafana CLI documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/) for setup instructions.

Push the repository configuration:

```sh
gcx resources push --path <DIRECTORY>
```

The `--path` parameter has to point to the directory containing your `repository.yaml` file.

After pushing, Grafana will:

1. Create the repository resource
1. Read the dashboards from the configured local path
1. Begin syncing at the configured interval

### Manage the repository resource

Use the following commands to manage file provisioning repositories.

To list all repositories:

```sh
gcx resources get repositories
```

To get details for a specific repository:

```sh
gcx resources get repository/<REPOSITORY_NAME>
gcx resources get repository/<REPOSITORY_NAME> -o json
gcx resources get repository/<REPOSITORY_NAME> -o yaml
```

To update a repository:

```sh
gcx resources edit repository/<REPOSITORY_NAME>
```

To delete a repository:

```sh
gcx resources delete repository/<REPOSITORY_NAME>
```

## Verify your dashboards in Grafana

To verify that your dashboards are available at the location that you specified, click **Dashboards**. The name of the dashboard is listed in the **Name** column.
