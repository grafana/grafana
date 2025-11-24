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
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/export-resources/
---

# Export non-provisioned resources from Grafana

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud. Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided. You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

Git Sync and local file provisioning are [experimental features](https://grafana.com/docs/release-life-cycle/) introduced in Grafana v12 for open source and Enterprise editions. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided.

{{< /admonition >}}

Git Sync is under development, and traditional operations like `import`, `copy`, `move`, or `save` are not yet supported for dashboards already existing in Grafana. To use Git Sync with existing dashboards you must export them to the repository first. 

Currently, Git Sync doesn't offer any built-in functionality to easily export resources from Grafana in bulk. However, the following options are available: 

- Export the dashboard with [grafanactl](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/grafana-cli/) and commit (recommended)
- Copy the dashboard as JSON and commit to the repository 

## Add an existing Grafana dashboard to Git Sync

To add an existing dashboard to Git Sync, you need to:

1. Export the dashboard as JSON
1. Convert it to the Custom Resource Definition (CRD) format required by the Grafana App Platform
1. Commit the converted file to your Git repository

### Required JSON format

To export a dashboard as a JSON file it must follow this CRD structure:

```yaml
{
  "apiVersion": "dashboard.grafana.app/v1beta1",
  "kind": "Dashboard",
  "metadata": {
    "name": "dcf2lve9akj8xsd"
  },
  "spec": {
    /* Original dashboard JSON goes here */
  }
}
```

The structure includes:

- `apiVersion`: Specifies the API version (currently `v1beta1`)
- `kind`: Identifies the resource type (Dashboard)
- `metadata`: Contains the dashboard identifier `uid`. You can find the identifier in the dahsboard's URL or in the exported JSON
- `spec`: Wraps your original dashboard JSON

## Edit Git-managed dashboards

After you've saved a dashboard in Git, it'll be synchronized automatically, and you'll be able to work with it as any other provisioned resource. Refer to [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/provisioned-dashboards/) for more information.







