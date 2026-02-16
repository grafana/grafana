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
weight: 300
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/export-resources/
aliases:
  - ../provision-resources/export-resources/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
---

# Export non-provisioned resources from Grafana

{{< admonition type="caution" >}}

Git Sync is available in [public preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud, and is an [experimental feature](https://grafana.com/docs/release-life-cycle/) in Grafana v12 for open source and Enterprise editions. Documentation and support is available **based on the different tiers** but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided.

**Git Sync is under development.** Refer to [Usage and performance limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits) for more information. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

Git Sync is under development, and traditional operations like `import`, `copy`, `move`, or `save` to a provisioned folder are not yet supported for dashboards already existing in Grafana. To use Git Sync with existing dashboards you must export them to the repository first.

Currently, Git Sync doesn't offer any built-in functionality to easily export resources from Grafana in bulk. However, the following options are available:

- [Export the dashboard with Grafana CLI](#add-a-dashboard-with-grafana-cli) (recommended)
- [Copy the dashboard as JSON and commit to the repository](#add-a-dashboard-via-json-export)

{{< admonition type="caution" >}}

Refer to [Known limitations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/usage-limits/) before using Git Sync.

{{< /admonition >}}

## Add a dashboard with Grafana CLI

You can export an existing dashboard with the [Grafana CLI](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/) and commit it to your Git repository.

Use `grafanactl` to download the resources you want to sync from Grafana, and then commit and push those files to the repository. Git Sync will then detect the commit, and synchronize with Grafana. To do so, follow these steps:

1. Set up the `grafanactl` context to point to your instance as documented in [Defining contexts](https://grafana.github.io/grafanactl/configuration/#defining-contexts).
1. Pull the resources you want to sync from the instance to your local repository:

```
grafanactl resources pull dashboards --path <REPO_PATH>
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

1. Export the dashboard as JSON
1. Convert it to the Custom Resource Definition (CRD) format required by the Grafana App Platform
1. Commit the converted file to your Git repository

### Required JSON format

To export a dashboard as a JSON file it must follow this CRD structure:

```yaml
{
  'apiVersion': 'dashboard.grafana.app/v1beta1',
  'kind': 'Dashboard',
  'metadata': { 'name': 'dcf2lve9akj8xsd' },
  'spec': { /* Original dashboard JSON goes here */ },
}
```

The structure includes:

- `apiVersion`: Specifies the API version (currently `v1beta1`)
- `kind`: Identifies the resource type (Dashboard)
- `metadata`: Contains the dashboard identifier `uid`. You can find the identifier in the dahsboard's URL or in the exported JSON
- `spec`: Wraps your original dashboard JSON

## Edit Git-managed dashboards

After you've saved a dashboard in Git, it'll be synchronized automatically, and you'll be able to work with it as any other provisioned resource. Refer to [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/provisioned-dashboards/) for more information.
