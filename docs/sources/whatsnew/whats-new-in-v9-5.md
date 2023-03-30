---
description: Feature and improvement highlights for Grafana v9.5
keywords:
  - grafana
  - new
  - documentation
  - '9.5'
  - release notes
title: What's new in Grafana v9.5
weight: -33
---

# What’s new in Grafana v9.5

Welcome to Grafana 9.5! Read on to learn about changes to search and navigation, dashboards and visualizations, and authentication and security. For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

<!-- Template below

## Feature
[Generally available | Available in experimental/beta] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]

Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).

> **Note:** You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).-->

## Nav navigation

_Generally available in all editions of Grafana._

The navigation in Grafana has been updated with a new design and an improved structure to make it easier for you to access the data you need. With this update, you'll be able to quickly navigate between features, giving you full visibility into the health of your systems.

Grafana’s navigation has received a major overhaul. The new design and improved structure make it easier for users to access the data they need, enabling quick navigation between features and providing full visibility into the health of their systems.

As Grafana evolved from a visualization platform to a comprehensive observability solution, we added numerous tools to support users throughout the software development life cycle. These tools focus on preventing incidents, monitoring applications or infrastructure, and aiding in incident response. However, the added functionality needs to be easily discoverable and navigable for it to be truly helpful.

These are the key updates to Grafana’s navigation experience:

- A redesigned navigation menu that groups related tools together for easy access.
- Updated layouts featuring breadcrumbs and a sidebar, allowing users to quickly jump between pages.
- A new header that appears on all pages in Grafana, which includes a search function.

Join the [discussion on GitHub](https://github.com/grafana/grafana/discussions/58910) and share your feedback.

{{< figure src="/media/docs/grafana/navigation-9-4.png" max-width="750px" caption="Grafana new navigation" >}}

## Nested folders

_Available in experimental in all editions of Grafana._

You can now create nested folders in Grafana to help you better organize your dashboards and alerts. This new feature allows you to create, read, update, and delete nested folders, making it easier to sort resources by business units, departments, and teams.

You can also set up permissions using Role-Based Access Control (RBAC). Folder permissions will cascade, being inherited from the parent folder, which simplifies access management.

It's worth noting that the nested folders feature is currently experimental. As such, it's recommended to enable it only on test or development instances, rather than in production environments.

To try out the nested folders feature, you'll need to enable the `nestedFolders` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

In subsequent releases, we’ll be refining and enhancing the user interface for managing dashboards and folders, to provide a more streamlined user experience.

## Dashboards and visualizations

### Redesigned empty dashboard state

_Generally available in all editions of Grafana using the emptyDashboardPage [feature toggle]({{< relref "../setup-grafana/configure-grafana/#feature_toggles" >}}). The default value is `true` and you can disable it in config._

Dashboards have been updated so that it’s easier to begin building from an empty dashboard state. The options displayed when you add a new dashboard—adding a visualization, a row, or importing panels—each include brief explanations of what those steps will do, so you can begin building with confidence.

Also, a text **Add** dropdown with these options has replaced the previous icon at the top of the dashboard. This makes it clearer that this element allows you to not just add new panels, but to take all the actions associated with building a new dashboard.

{{< figure src="/media/docs/grafana/screenshot-empty-dashboard-whats-new-9-5.png" max-width="750px" caption="Dashboard without any visualizations added" >}}

### Dashboard panel redesign

_Generally available in all editions of Grafana._

Dashboard panels contain a lot of information, some of which is difficult to discover or access from the dashboard. With our redesigned panels, we've improved accessibility and made it easier to understand the status of a panel by adding and moving key elements.

We’ve improved the support of panels without a header, made a distinction between details set by you and data-induced information, and then included all essential components in the header of the panel. All of these are laid out from left to right in a row, so there are no overlapping, unusable components.

Grafana’s new panel is available only for React-based panels; no Angular-based panels are redesigned. For example, Angular-based panel will still have the old Graph and Table visualizations.

## Users and roles

### Organization roles for users logged in through Auth providers

_Available in experimental in all editions of Grafana._

We are slowly rolling out a feature toggle for enforcing syncronization of organization roles for organization roles sync from the authentication provider on user sign-in. The feature will prohibit a user from changing organization roles synced with external auth providers.

If you want to enable this feature, you'll need to enable the `onlyExternalOrgRoleSync` feature toggle. If you’re using Grafana Cloud, and would like to enable this feature, please contact customer support.

A reminder that there is a setting to prevent synchronization of organization roles from the authentication provider regardless of their role in the authentication provider, then refer to the `skip_org_role_sync` setting in your Grafana configuration. Refer to [skip org role sync](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#authgrafana_com-skip_org_role_sync) for more information.

## Support bundles

_Generally available in all editions of Grafana._

Support bundles provide a simple way to collect information about your Grafana instance through Grafana's user interface. In a few clicks you can create a support bundle containing data about migrations, plugins, settings and more. This is particularly useful when troubleshooting issues with your Grafana instance.

Learn more about support bundles and how to configure them in our [support bundle documentation]({{< relref "../troubleshooting/support-bundles/" >}}).

## Alerting

### Search for alert rules from multiple data sources

Allows you to search for and display alert rules for multiple data sources at the same time.

### Fuzzy search on the Alert rule list view

Search for namespaces or folders, evaluation groups, and alert rule names on the Alert rules list view with immediate results and regardless of typos.

### Access an alert rule from a dashboard or a panel

Navigate to an alert rule directly from a dashboard or a panel to easily dive into the alert rule details.

{{< figure src="/media/docs/alerting/alert-rule-dashboard.png" max-width="750px" caption="Access an alert rule from a dashboard or a panel" >}}

### Access a dashboard or panel from an alert rule

Navigate from an alert rule straight to a dashboard or a panel associated with the alert rule to visualize your alerting data.

{{< figure src="/media/docs/alerting/dashboard-alert-rule.png" max-width="750px" caption="Access a dashboard or panel from an alert rule" >}}

### Preview queries for recording rules

Preview queries when creating or editing recording rules, so you can visualize the results of your query before saving your recording rule.

{{< figure src="/media/docs/alerting/preview-queries-recording-rule.png" max-width="750px" caption="Preview queries for recording rules" >}}

### Updates alert behavior for no data evaluation

Alert rules that are configured to fire when an evaluation returns no data now only fire when the entire duration of the evaluation period has finished. This means that rather than immediately firing when the alert rule condition is breached, the alert rule waits until the time set in the For field has finished and then fires, reducing alert noise and allowing for temporary data availability issues.

### Improved Notification Policies view

- Updates to the notification policies view make it easier to use and manage:
- View default policy and nested policies at a glance
- New tab for mute timings
- View alert instances for each policy
- View contact points and which integrations are configured for each policy
- View inherited properties on nested policies
  Search for labels and for contact points to see which notifications are going where

{{< figure src="/media/docs/alerting/notification-policies-view.png" max-width="750px" caption="Improved Notification Policies view" >}}

### Guidance for configuring your Alertmanager

Get additional help while configuring your Alertmanager. If you enter an invalid Alertmanager configuration, an error message displays, and you can choose from a previous working configuration to restart it.
