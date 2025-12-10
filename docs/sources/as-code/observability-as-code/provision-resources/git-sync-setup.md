---
description: Instructions for setting up Git Sync, so you can provision GitHub repositories for use with Grafana.
keywords:
  - set up
  - git integration
  - git sync
  - github
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Set up Git Sync
weight: 110
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/git-sync-setup/
aliases:
  - ../../../observability-as-code/provision-resources/git-sync-setup/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
---

# Set up Git Sync

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions.

Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

{{< /admonition >}}

## Before you begin

### Known limitations

{{< admonition type="caution" >}}

Refer to [Known limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/intro-git-sync#known-limitations/) before using Git Sync. Refer to [Supported resources](/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/intro-git-sync#supported-resources) for details about which resources you can sync.

{{< /admonition >}}

The following applies:

- Git Sync only supports dashboards and folders. Alerts, panels, and other resources are not supported yet.
- Full instance sync is not available in Grafana Cloud.
- In Grafana OSS/Enterprise:
  - If you try to perform a full instance sync with resources that contain alerts or panels, Git Sync will block the connection.
  - You won't be able to create new alerts or library panels after the setup is completed.
  - If you opted for full instance sync and want to use alerts and library panels, you'll have to delete the synced repository and connect again with folder sync.

### Performance impacts of enabling Git Sync

When Git Sync is enabled, the database load might increase, especially for instances with a lot of folders and nested folders. Evaluate the performance impact, if any, in a non-production environment.

Git Sync is under continuous development. Reporting any issues you encounter can help us improve Git Sync.

## Set up Git Sync (recommended)

To set up Git Sync and synchronize with a GitHub repository follow these steps:

1. [Enable feature toggles in Grafana](#enable-required-feature-toggles) (first time set up).
1. [Create a GitHub access token](#create-a-github-access-token).
1. [Configure a connection to your GitHub repository](#set-up-the-connection-to-github).
1. [Choose what content to sync with Grafana](#choose-what-to-synchronize).

Optionally, you can [extend Git Sync](#configure-webhooks-and-image-rendering) by enabling pull request notifications and image previews of dashboard changes.

| Capability                                            | Benefit                                                                         | Requires                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------- |
| Adds a table summarizing changes to your pull request | Provides a convenient way to save changes back to GitHub.                       | Webhooks configured                    |
| Add a dashboard preview image to a PR                 | View a snapshot of dashboard changes to a pull request without opening Grafana. | Image renderer and webhooks configured |

{{< admonition type="note" >}}

Alternatively, you can configure a local file system instead of using GitHub. Refer to [Set up file provisioning](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/file-path-setup/) for more information.

{{< /admonition >}}

### Requirements

To set up Git Sync, you need:

- Administration rights in your Grafana organization.
- Enable the required feature toggles in your Grafana instance. Refer to [Enable required feature toggles](#enable-required-feature-toggles) for instructions.
- A GitHub repository to store your dashboards in.
  - If you want to use a local file path, refer to [the local file path guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/file-path-setup/).
- A GitHub access token. The Grafana UI will prompt you during setup.
- Optional: A public Grafana instance.
- Optional: The [Image Renderer service](https://github.com/grafana/grafana-image-renderer) to save image previews with your PRs.

### Enable required feature toggles

To activate Git Sync in Grafana, you need to enable the `provisioning` and `kubernetesDashboards` feature toggles.
For additional information about feature toggles, refer to [Configure feature toggles](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles).

To enable the required feature toggles, add them to your Grafana configuration file:

1. Open your Grafana configuration file, either `grafana.ini` or `custom.ini`. For file location based on operating system, refer to [Configuration file location](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/#experimental-feature-toggles).
1. Locate or add a `[feature_toggles]` section. Add these values:

   ```ini
   [feature_toggles]
   provisioning = true
   kubernetesDashboards = true ; use k8s from browser
   ```

1. Save the changes to the file and restart Grafana.

### Create a GitHub access token

Whenever you connect to a GitHub repository, you need to create a GitHub access token with specific repository permissions.
This token needs to be added to your Git Sync configuration to enable read and write permissions between Grafana and GitHub repository.

1. Create a new token using [Create new fine-grained personal access token](https://github.com/settings/personal-access-tokens/new). Refer to [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) for instructions.
1. Under **Permissions**, expand **Repository permissions**.
1. Set these permissions for Git Sync:
   - **Contents**: Read and write permission
   - **Metadata**: Read-only permission
   - **Pull requests**: Read and write permission
   - **Webhooks**: Read and write permission

1. Select any additional options and then press **Generate token**.
1. Verify the options and select **Generate token**.
1. Copy the access token. Leave the browser window available with the token until you've completed configuration.

GitHub Apps are not currently supported.

### Set up the connection to GitHub

Use **Provisioning** to guide you through setting up Git Sync to use a GitHub repository.

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration** in the left-side menu and then **Provisioning**.
1. Select **Configure Git Sync**.

#### Connect to external storage

To connect your GitHub repository, follow these steps:

1. Paste your GitHub personal access token into **Enter your access token**. Refer to [Create a GitHub access token](#create-a-github-access-token) for instructions.
1. Paste the **Repository URL** for your GitHub repository into the text box.
1. Enter a branch to use. The default value is `main`.
1. Add a **Path** to a subdirectory where your dashboards are stored. The default value is `grafana/`. If your dashboards are stored in the root of your repository, then remove the directory name.
1. Select **Choose what to synchronize** to have the connection to your repository verified and continue setup.

### Choose what to synchronize

In this step you can decide which elements to synchronize. Keep in mind the available options depend on the status of your Grafana instance.

- If the instance contains resources in an incompatible data format, you'll have to migrate all the data using instance sync. Folder sync won't be supported.
- If there is already another connection using folder sync, instance sync won't be offered.

#### Set up synchronization

To set up synchronization, choose to either sync your entire organization resources with external storage, or to sync certain resources to a new Grafana folder (with up to 10 connections).

- Choose **Sync all resources with external storage** if you want to sync and manage your entire Grafana instance through external storage. With this option, all of your dashboards are synced to that one repository. You can only have one provisioned connection with this selection, and you won't have the option of setting up additional repositories to connect to.
- Choose **Sync external storage to new Grafana folder** to sync external resources into a new folder without affecting the rest of your instance. You can repeat this process for up to 10 connections.

Next, enter a **Display name** for the repository connection. Resources stored in this connection appear under the chosen display name in the Grafana UI. Click **Synchronize** to continue.

### Choose additional settings

Finally, you can set up how often your configured storage is polled for updates.

1. For **Update instance interval (seconds)**, enter how often you want the instance to pull updates from GitHub. The default value is 60 seconds.
1. Optional: Select **Read only** to ensure resources can't be modified in Grafana.
1. Optional: If you have the Grafana Image Renderer plugin configured, you can **Enable dashboards previews in pull requests**. If image rendering is not available, then you can't select this option. For more information, refer to the [Image Renderer service](https://github.com/grafana/grafana-image-renderer).
1. Select **Finish** to proceed.

## Set up Git Sync using Grafana CLI

Alternatively, you can also configure Git Sync using `grafanactl`. Since Git Sync configuration is managed as code using Custom Resource Definitions (CRDs), you can create a Repository CRD in a YAML file and use `grafanactl` to push it to Grafana.

This approach enables automated, GitOps-style workflows for managing Git Sync configuration instead of using the Grafana UI.

### Prerequisites

- **grafanactl CLI** - Install from https://grafana.github.io/grafanactl/
- **GitHub repository** containing your dashboards
- **GitHub Personal Access Token** with scopes: `repo`, `pull_requests`, `webhooks`
- **Grafana instance** with external access (public URL or webhook endpoint)

### Create Repository CRD

Create a `repository.yaml` file defining your Git Sync configuration:

```yaml
apiVersion: provisioning.grafana.app/v0alpha1
kind: Repository
metadata:
  name: <REPOSITORY_NAME>
spec:
  title: <REPOSITORY_TITLE>
  type: github
  github:
    url: <GITHUB_REPO_URL>
    branch: <BRANCH>
    path: grafana/
    generateDashboardPreviews: true
  sync:
    enabled: true
    intervalSeconds: 60
    target: folder
  workflows:
    - write
    - branch
secure:
  token:
    create: <GITHUB_PAT>
```

**Note:** Only `target: folder` is currently supported for Git Sync.

#### Configuration Parameters

| Field | Description |
|-------|-------------|
| `metadata.name` | Unique identifier for this repository resource |
| `spec.title` | Human-readable name displayed in Grafana UI |
| `spec.type` | Repository type (`github`) |
| `spec.github.url` | GitHub repository URL |
| `spec.github.branch` | Branch to sync |
| `spec.github.path` | Directory path containing dashboards |
| `spec.github.generateDashboardPreviews` | Generate preview images (true/false) |
| `spec.sync.enabled` | Enable synchronization (true/false) |
| `spec.sync.intervalSeconds` | Sync interval in seconds |
| `spec.sync.target` | Where to place synced dashboards (`folder`) |
| `spec.workflows` | Enabled workflows: `write` (direct commits), `branch` (PRs) |
| `secure.token.create` | GitHub Personal Access Token |

### Push Repository CRD to Grafana

Before pushing resources, configure `grafanactl` with your Grafana instance details. Refer to the [grafanactl configuration documentation](https://grafana.github.io/grafanactl/) for setup instructions.

Push the repository configuration:

```bash
grafanactl resources push --path <DIRECTORY>
```

The `--path` parameter should point to the directory containing your `repository.yaml` file.

After pushing, Grafana will:
1. Create the repository resource
2. Connect to your GitHub repository
3. Pull dashboards from the specified path
4. Begin syncing at the configured interval

### Managing Repository Resources

#### List Repositories

```bash
grafanactl resources get repositories
```

#### Get Repository Details

```bash
grafanactl resources get repository/<REPOSITORY_NAME>
grafanactl resources get repository/<REPOSITORY_NAME> -o json
grafanactl resources get repository/<REPOSITORY_NAME> -o yaml
```

#### Update Repository

```bash
grafanactl resources edit repository/<REPOSITORY_NAME>
```

#### Delete Repository

```bash
grafanactl resources delete repository/<REPOSITORY_NAME>
```

### Verify Setup

Check that Git Sync is working:

```bash
# List repositories
grafanactl resources get repositories

# Check Grafana UI
# Navigate to: Administration → Provisioning → Git Sync
```
### Additional Resources

- [grafanactl Documentation](https://grafana.github.io/grafanactl/)
- [Repository CRD Reference](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/git-sync-setup/)
- [Dashboard CRD Format](https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/export-resources/)

## Verify your dashboards in Grafana

To verify that your dashboards are available at the location that you specified, click **Dashboards**. The name of the dashboard is listed in the **Name** column.

Now that your dashboards have been synced from a repository, you can customize the name, change the branch, and create a pull request (PR) for it. Refer to [Manage provisioned repositories with Git Sync](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/observability-as-code/provision-resources/use-git-sync/) for more information.

## Configure webhooks and image rendering

You can extend Git Sync by getting instant updates and pull requests using webhooks and add dashboard previews in pull requests.

### Set up webhooks for realtime notification and pull request integration

When connecting to a GitHub repository, Git Sync uses webhooks to enable real-time updates from GitHub public repositories or enable pull request integrations. Without webhooks, the polling interval is set in the final configuration screen, and the default is 60 seconds. If you use local storage, then Git Sync only provides periodic pulling.

You can set up webhooks with whichever service or tooling you prefer. You can use Cloudflare Tunnels with a Cloudflare-managed domain, port-forwarding and DNS options, or a tool such as `ngrok`.

To set up webhooks you need to expose your Grafana instance to the public Internet. You can do this via port forwarding and DNS, a tool such as `ngrok`, or any other method you prefer. The permissions set in your GitHub access token provide the authorization for this communication.

After you have the public URL, you can add it to your Grafana configuration file:

```yaml
[server]
root_url = https://PUBLIC_DOMAIN.HERE
```

To check the configured webhooks, go to **Administration** > **Provisioning** and click the **View** link for your GitHub repository.

#### Expose necessary paths only

If your security setup does not permit publicly exposing the Grafana instance, you can either choose to `allowlist` the GitHub IP addresses, or expose only the necessary paths.

The necessary paths required to be exposed are, in RegExp:

- `/apis/provisioning\.grafana\.app/v0(alpha1)?/namespaces/[^/]+/repositories/[^/]+/(webhook|render/.*)$`
<!-- TODO: Path for the blob storage for image rendering? @ryantxu would know this best. -->

### Set up image rendering for dashboard previews

Set up image rendering to add visual previews of dashboard updates directly in pull requests. Image rendering also requires webhooks.

To enable this capability, install the Grafana Image Renderer in your Grafana instance. For more information and installation instructions, refer to the [Image Renderer service](https://github.com/grafana/grafana-image-renderer).

## Modify your configuration after set up is complete

To update your repository configuration after you've completed set up:

1. Log in to your Grafana server with an account that has the Grafana Admin flag set.
1. Select **Administration** in the left-side menu and then **Provisioning**.
1. Select **Settings** for the repository you wish to modify.
1. Use the **Configure repository** screen to update any of the settings.
1. Select **Save** to preserve the updates.
