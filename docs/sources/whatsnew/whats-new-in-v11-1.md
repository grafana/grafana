---
description: Feature and improvement highlights for Grafana v11.1
keywords:
  - grafana
  - new
  - documentation
  - '11.1'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v11.1
weight: -43
---

<!-- vale GoogleWe = NO -->
<!-- vale We = NO -->

# What’s new in Grafana v11.1

Welcome to Grafana 11.1! This release contains some major improvements: most notably,

<!--{{< youtube id=" " >}}-->

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v11.1, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v11.1/).

<!--## Breaking changes

For Grafana v11.0, we've also provided a list of [breaking changes](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/breaking-changes/breaking-changes-v11-0) to help you upgrade with greater confidence. For information about these along with guidance on how to proceed, refer to [Breaking changes in Grafana v11.0](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/breaking-changes/breaking-changes-v11-0/).-->

## Alerting

<!-- TO DO - Confirm with Alerting folks that everything available in OSS is also available in Enterprise except for Rule specific silences with permissions and Rule specific silences with RBAC-->

### Re-designed settings page for Alerting

<!-- Gilles De Mey -->

_Generally available in all editions of Grafana_

The new settings page provides you with a holistic view of where Grafana-managed alert instances are forwarded.

- Manage which Alertmanagers receive alert instances from Grafana-managed rules without navigating and editing data sources.
- Manage version snapshots for the built-in Alertmanager, which allows administrators to roll back unintentional changes or mistakes in the Alertmanager configuration.
- There is also a visual diff that compares the historical snapshot with the latest configuration to see which changes were made.

{{< figure src="/media/docs/alerting/alert-settings.png" alt="Alert settings page" >}}

### Alerting template selector

<!-- Sonia Aguilar -->

_Generally available in all editions of Grafana_

Enables you to easily choose which templates you want to use in your alert notification messages by adding a template selector in the Contact Points form.

Select from existing templates or enter a custom one for your specific needs. You can switch between the two tabs to access the list of available templates and copy them across to the customized version.

### Add OAuth2 to HTTP settings for vanilla Alertmanager / Mimir

<!-- Gilles de Mey -->

_Generally available in all editions of Grafana_

Configure OAuth2 authentication for any Alertmanager or Mimir receiver (called Contact Points in Grafana) through the user interface.

OAuth2 is not implemented for the Grafana built-in Alertmanager.

### Improved paused alert visibility

<!-- Tom Ratcliffe -->

_Generally available in all editions of Grafana_

Pause and resume alert rule evaluation directly from the Alert rules list and details view. This helps Improve visibility of when alert rules have been paused by displaying “Paused” as the alert rule state.

### Removes requirement of datasources:query permission for reading rules

<!-- William Wernert -->

_Generally available in all editions of Grafana_

Fetching a rule group no longer requires the **datasources:query** permission for every data source used by the rules within that group. Now, the only requirements are **alert.rules:read** and **folders:read** for the folder the group is contained in.

Note: **datasources:query** is still required to preview an alert rule, regardless of alert rules and folders permissions.

### Rule-specific silences with permissions

<!-- Tom Ratcliffe -->

_Generally available in all editions of Grafana_

More easily create silences directly from the Alert rule list view or detail page.

These rule-specific silences are guaranteed to only apply to a single rule and permissions to read, create, update or delete are tied to a user’s permissions for that rule.

### Rule-specific silences with RBAC

<!-- Tom Ratcliffe -->

_Generally available in Grafana Enterprise and Cloud_

Manage silences through Role-Based Access Control (RBAC). In addition to the Grafana open source functionality in **Rule-specific silences with permissions**, you can choose who can create, edit, and read silences using the following permissions:

- Users with the **alert.silences:create permission**, scoped within a folder, are able to create silences for rules contained within that folder and its subfolders
- Users with the **alert.silences:read permission**, scoped within a folder, are able to read silences for rules contained within that folder and its subfolders, and general silences
- Users with the **alert.silences:write permission**, scoped within a folder, are able to expire and recreate silences for rules contained within that folder and its subfolders
