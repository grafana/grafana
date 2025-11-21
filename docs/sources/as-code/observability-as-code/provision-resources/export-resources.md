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
title: Export non-provisioned resources from Grafana
menuTitle: Export non-provisioned resources
weight: 300
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/provision-resources/export-resources/
---

# Export non-provisioned resources from Grafana

{{< admonition type="caution" >}}

Git Sync is available in [private preview](https://grafana.com/docs/release-life-cycle/) for Grafana Cloud. Support and documentation is available but might be limited to enablement, configuration, and some troubleshooting. No SLAs are provided. You can sign up to the private preview using the [Git Sync early access form](https://forms.gle/WKkR3EVMcbqsNnkD9).

Git Sync and local file provisioning are [experimental features](https://grafana.com/docs/release-life-cycle/) introduced in Grafana v12 for open source and Enterprise editions. Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided.

{{< /admonition >}}

Git Sync is under development, and traditional operations like `import`, `copy`, `move`, or `save` are not yet supported for dashboards already existing in Grafana. 

You have two options for creating new dashboards or folders in Git Sync:

- Create them directly within Git Sync-managed folders in the Grafana UI
- Add them by committing JSON files to your Git repository, as described in this document

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
- `metadata`: Contains the dashboard identifier
- `spec`: Wraps your original dashboard JSON

## Edit Git-managed dashboards

When a dashboard is under Git Sync management, you can edit, delete, or save it similarly to traditional dashboards. However, these operations require a Git-based workflow:

- Make your changes in the Grafana UI
- Provide a commit message describing your changes
- Push to a branch in your repository
- Open a pull request for review

This workflow ensures all changes are version-controlled and can be reviewed before being applied, aligning with GitOps principles and enabling team collaboration through standard Git workflows.

For more information:

- [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/provisioned-dashboards/)
- [GitSync demo](https://github.com/grafana/grafana-git-sync-demo) 







