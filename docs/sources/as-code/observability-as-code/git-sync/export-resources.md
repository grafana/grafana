---
description: Export non-provisioned resources from Grafana.
keywords:
  - dashboards
  - resources
  - git sync
  - github
  - export
labels:
  products:
    - enterprise
    - oss
    - cloud
title: Add non-provisioned resources from Grafana
menuTitle: Add non-provisioned resources
weight: 400
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/export-resources/
aliases:
  - ../provision-resources/export-resources/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
---

# Export non-provisioned resources from Grafana

{{< admonition type="note" >}}

**Git Sync is now GA for Grafana Cloud, OSS and Enterprise.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) to understand usage limits for the different tiers.

[Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

You can add dashboards to Git Sync using any of the following options:

- [Add a dashboard using Import dashboards](#add-a-dashboard-using-import-dashboards)
- [Export an existing dashboard from the Grafana UI as a copy](#copy-an-existing-dashboard-from-the-grafana-ui)
- [Export a dashboard with Grafana CLI](#add-a-dashboard-with-the-grafana-cli)
- [Copy a dashboard as JSON and commit to the repository](#add-a-dashboard-via-json-export)

## Add a dashboard using Import dashboards

You can import dashboards directly into your Git Sync provisioned folders using the Grafana UI or the HTTP API.

For more information refer to [Import dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/import-dashboards/) in the Data Visualization documentation.

## Copy an existing dashboard from the Grafana UI

You can also save a copy of dashboard directly from the Grafana UI to your provisioned folder.

To do so, follow these steps:

1. Make sure the dashboard is in **Editable** mode.
1. Select **Save** or **Save as** from the top-right corner.
1. In the menu:
   - **Target folder**: Select the provisioned folder from your Grafana UI where you want to save the dashboard in.
   - **Branch**: Type in the name of the branch of the provisioned repository you want to work in, or create a new branch. Committing directly to `main` is not supported.
   - **Folder**: Type in the folder in your sync repository, if any.
   - Fill in the rest of the fields accordingly.
1. Click **Save**.
1. In your synced GitHub repository, merge the branch with the dashboard you want to sync.

## Add a dashboard with the Grafana CLI

You can also export an existing dashboard with `gcx`, the [Grafana CLI](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/). Use `gcx` to download the resources you want to sync from Grafana, and then commit and push those files to your provisioned Git repository. Git Sync will then detect the commit, and synchronize with Grafana.

To do so, follow these steps:

1. Set up the `gcx` context to point to your instance as documented in [Defining contexts](https://github.com/grafana/gcx/#1-authenticate).
1. Pull the resources you want to sync from the instance to your local repository:

```
gcx resources pull dashboards --path <REPO_PATH>
```

Next, commit and push the resources to your Git repository:

```
git add <DASHBOARDS_PATH>
git commit -m "Add dashboards from Grafana"
git push
```

Where:

- _<GIT_REPO>_: The path to the repository synced with Git Sync
- _<DASHBOARDS_PATH>_: The path where the dashboards you want to export are located. The dashboards path must be under the repository

See more at [Manage resources with Grafana CLI](https://grafana.github.io/grafanactl/guides/manage-resources/).

## Add a dashboard via JSON export

To add an existing dashboard to Git Sync via JSON export, you need to:

1. Export the dashboard as JSON.
1. Convert it to the Custom Resource Definition (CRD) format required by the Grafana App Platform.
1. Commit the converted file to your Git repository.

### Required JSON format

To export a dashboard as a JSON file it must follow this CRD structure:

```yaml
{
  'apiVersion': 'dashboard.grafana.app/v1',
  'kind': 'Dashboard',
  'metadata': { 'name': 'dcf2lve9akj8xsd' },
  'spec': { /* Original dashboard JSON goes here */ },
}
```

The structure includes:

- `apiVersion`: Specifies the API version. Both classic and `v2` JSON models are supported. For more information, refer to [Dashboard JSON model](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/visualizations/dashboards/build-dashboards/view-dashboard-json-model/)
- `kind`: Identifies the resource type (Dashboard)
- `metadata`: Contains the dashboard identifier `uid`. You can find the identifier in the dashboard's URL or in the exported JSON
- `spec`: Wraps your original dashboard JSON

## Work with Git-managed dashboards

After you've saved a dashboard in Git, it'll be synchronized automatically, and you'll be able to work with it as any other provisioned resource. Refer to [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/provisioned-dashboards/) for more information.
