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
canonical: https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/add-resources/
aliases:
  - ../provision-resources/export-resources/ # /docs/grafana/next/observability-as-code/provision-resources/git-sync-setup/
  - ../export-resources/ # /docs/grafana/next/as-code/observability-as-code/git-sync/export-resources/
---

# Add non-provisioned resources from Grafana

{{< admonition type="note" >}}

Git Sync functionalities are constantly evolving. [Contact Grafana](https://grafana.com/help/) for support or to report any issues you encounter and help us improve this feature.

{{< /admonition >}}

At the moment Git Sync only manages dashboards and folders. Alerts, data sources, and library panels are **not** supported yet. If you want to sync existing, non-provisioned resources, you have two options:

- [Cherry-pick and copy individual dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/add-resources/dashboards-copy): Add a copy of a selected dashboard to a provisioned folder. Grafana creates a **new** dashboard with a **new UID**; the original is left untouched and existing links keep pointing to it.
  - This is the simplest option and doesn't require deleting anything.
- [Migrate existing dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/add-resources/dashboards-migrate): Move existing dashboards under Git Sync while **keeping their UID**, so existing links and references keep working.
  - This option requires additional care since it adopts the resource in place and requires deleting the original resource.
  - If you chose to migrate your dashboards, refer to [Before you begin](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/git-sync/add-resources/dashboards-migrate#before-you-begin) for details.

## Work with Git-managed dashboards

After you've saved a dashboard in Git, it'll be synchronized automatically, and you'll be able to work with it as any other provisioned resource. Refer to [Work with provisioned dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/as-code/observability-as-code/provision-resources/provisioned-dashboards/) for more information.
