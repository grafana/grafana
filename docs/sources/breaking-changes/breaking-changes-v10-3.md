---
description: Breaking changes for Grafana v10.3
keywords:
  - grafana
  - breaking changes
  - documentation
  - '10.3'
  - '10.2.3'
  - release notes
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Breaking changes in Grafana v10.3
weight: -2
---

# Breaking changes in Grafana v10.3

Following are breaking changes that you should be aware of when upgrading to Grafana v10.3. Breaking changes that were introduced in release 10.2.3 are also included here and are marked with an asterisk.

For our purposes, a breaking change is any change that requires users or operators to do something. This includes:

- Changes in one part of the system that could cause other components to fail
- Deprecations or removal of a feature
- Changes to an API that could break automation
- Changes that affect some plugins or functions of Grafana
- Migrations that can’t be rolled back

For each change, the provided information:

- Helps you determine if you’re affected
- Describes the change or relevant background information
- Guides you in how to mitigate for the change or migrate
- Provides more learning resources

For release highlights and deprecations, refer to our [v10.3 What’s new](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/whatsnew/whats-new-in-v10-3/). For the specific steps we recommend when you upgrade to v10.3, check out our [Upgrade guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v10.3/).

<!--
## Feature

You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).-->

## General breaking changes

### Transformations\*

In panels using the extract fields transformation, where one of the extracted names collides with one of the already existing fields, the extracted field will be renamed. Issue [#77569](https://github.com/grafana/grafana/issues/77569).

If you use the Table visualization, you might see some inconsistencies in your panels. We have updated the table column naming. This will potentially affect field transformations and/or field overrides. To resolve this, either:

- Update the transformation you are using
- Update field override. Issue [#76899](https://github.com/grafana/grafana/issues/76899).

Users who have transformations with the Time field might see their transformations are not working. Those panels that have broken transformations will fail to render. This is because we changed the field key. See related PR: [#69865](https://github.com/grafana/grafana/pull/69865). To resolve this, either:

- Remove the affected panel and re-create it
- Select the Time field again
- Edit the time field as Time for transformation in panel.json or dashboard.json. Issue [#76641](https://github.com/grafana/grafana/issues/76641).

### Data source permissions\*

The following data source permission endpoints have been removed:

- `GET /datasources/:datasourceId/permissions`
- `POST /api/datasources/:datasourceId/permissions`
- `DELETE /datasources/:datasourceId/permissions`
- `POST /datasources/:datasourceId/enable-permissions`
- `POST /datasources/:datasourceId/disable-permissions`

Please use the following endpoints instead:

- `GET /api/access-control/datasources/:uid` for listing data source permissions
- `POST /api/access-control/datasources/:uid/users/:id`, `POST /api/access-control/datasources/:uid/teams/:id`, and `POST /api/access-control/datasources/:uid/buildInRoles/:id` for adding or removing data source permissions

If you are using the Grafana provider for Terraform to manage data source permissions, you will need to upgrade your provider to [version 2.6.0](https://registry.terraform.io/providers/grafana/grafana/2.6.0/docs) or newer to ensure that data source permission provisioning keeps working. Issue [#5880](https://github.com/grafana/grafana-enterprise/pull/5880).
