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

Welcome to Grafana 9.5! We're excited to share some major updates to Grafana's navigation, tons of usability improvements to Alerting, and some promising experiments to help you query your Prometheus metrics. Also, read on to learn about our continued migration from API keys to service accounts, as well as deprecation of plugins that use Angular and a field in the InfluxDB data source.

For more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md). For the specific steps we recommend when you upgrade to v9.5, check out our [Upgrade Guide]({{< relref "../upgrade-guide/upgrade-v9.5/" >}}).

<!-- Template below

## Feature
[Generally available | Available in experimental/beta] in Grafana [Open Source, Enterprise, Cloud Free, Cloud Pro, Cloud Advanced]

Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).

> **Note:** You must use relative references when linking to docs within the Grafana repo. Please do not use absolute URLs. For more information about relrefs, refer to [Links and references](/docs/writers-toolkit/writing-guide/references/).-->

## Grafana's new navigation is GA

_Generally available in all editions of Grafana._

The navigation in Grafana has been updated with a new design and an improved structure to make it easier for you to access the data you need. With this update, you'll be able to quickly navigate between pages, giving you full visibility into the health of your systems.

As Grafana evolved from a visualization platform to a comprehensive observability solution, we added numerous tools to support users throughout the software development life cycle. These tools focus on preventing incidents, monitoring applications or infrastructure, and aiding in incident response. However, the added functionality needs to be easily discoverable and navigable for it to be truly helpful.

These are the key updates to Grafana’s navigation experience:

- A redesigned navigation menu that groups related tools together for easy access.
- A command palette you can use to take actions in Grafana, like creating a dashboard or navigating to an app or page.
- Updated layouts featuring breadcrumbs and a sidebar, allowing you to quickly jump between pages.
- A new header that appears on all pages in Grafana, which includes a search function.

Join the [discussion on GitHub](https://github.com/grafana/grafana/discussions/58910) and share your feedback.

{{< figure src="/media/docs/grafana/navigation-9-4.png" max-width="750px" caption="Grafana new navigation" >}}

## Dashboards and visualizations

### Redesigned empty dashboard state

_Generally available in all editions of Grafana._

Dashboards have been updated so that it’s easier to begin building from scratch. The options displayed when you add a new dashboard—adding a visualization, a row, or importing panels—each include brief explanations of what those steps will do, so you can begin building with confidence.

Also, a text **Add** dropdown with these options has replaced the previous "+" icon at the top of the dashboard. This makes it clearer that this element allows you not only to add new panels, but to take all the actions associated with building a new dashboard.

{{< figure src="/media/docs/grafana/screenshot-empty-dashboard-whats-new-9-5.png" max-width="750px" caption="Dashboard without any visualizations added" >}}

### Dashboard panel redesign

_Generally available in all editions of Grafana._

Dashboard panels contain a lot of information, some of which is difficult to discover or access from the dashboard. With our redesigned panels, we've improved accessibility and made it easier to understand the status of a panel by adding and moving key elements.

We’ve improved panels without titles, made panel descriptions and errors more succinct, and linked key actions from the header of the panel. All of these are laid out from left to right in a row, so there are no overlapping, unusable components.

Grafana’s new panel design is available only for React-based panels. No Angular-based panels, like the legacy Graph and Worldmap panels, are redesigned. As a reminder, Angular is deprecated in Grafana and will be removed in a future release. See our [deprecation docs]({{< relref "../developers/angular_deprecation/" >}}) for more information.

{{< figure src="/media/docs/grafana/panel-redesign-whats-new-9.5.png" max-width="750px" caption="Panel header with no title" >}}

## Prometheus performance and usability improvements

### Prometheus metric encyclopedia

_Experimental in all editions of Grafana._

When you have thousands or millions of Prometheus metrics, it can be hard to find the exact one you're looking for. Enable feature toggle `prometheusMetricEncyclopedia` to replace the basic metric select dropdown in the Prometheus query builder with a paginated and searchable metric _encyclopedia_.

Here's what you can do with the metric encyclopedia:

- Fuzzy search for metrics by name, type, and description
- Filter metrics by Prometheus types (gauge, counter, histogram, summary)
- Display metrics in a paginated list, sort the results and choose a number of results per page, so that you don't wait too long for search results
- View metric details, like type and description
- Expert feature: Search metric names by regex using the backend only

### Prometheus browser cache

_Experimental in all editions of Grafana._

New feature toggle `prometheusResourceBrowserCache` provides the ability to cache Prometheus editor API calls in the Prometheus data source configuration.
This improves Prometheus query editor performance, the biggest performance improvements will be seen by users with high cardinality Prometheus instances.

## Removing the button to create API keys from the UI

With this update we are going one step further in deprecating API Keys in favour of [service accounts](https://grafana.com/docs/grafana/latest/administration/service-accounts/). We have removed the button to create new API keys through Grafana's user interface, and now only allow creating API keys via our HTTP API. We urge you to migrate your existing API keys to service accounts, and opt for new service accounts instead of new API keys. This change is part of our long-term strategy for sunsetting API keys.

Learn more about the deprecation strategy for API keys and how to manage them in our [Sunsetting API keys](https://github.com/grafana/grafana/issues/53567).

## Resolve Grafana issues faster with support bundles

_Generally available in all editions of Grafana._

Support bundles provide a simple way to collect information about your Grafana instance through Grafana's user interface. In a few clicks, you can create a support bundle containing data about migrations, plugins, settings, and more. Once you've created a support bundle, you can either examine it yourself, or share it with your colleagues or Grafana engineers to aid the troubleshooting of your Grafana instance.

Learn more about support bundles and how to configure them in our [support bundle documentation]({{< relref "../troubleshooting/support-bundles/" >}}).

{{< figure src="/static/img/docs/troubleshooting/support-bundle.png" max-width="750px" caption="Create a support bundle to resolve issues faster" >}}

## Alerting

_All Alerting improvements are generally available in all editions of Grafana._

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

Visualize queries when creating or editing recording rules, so you can see the results of your query before saving your recording rule.

{{< figure src="/media/docs/alerting/preview-queries-recording-rule.png" max-width="750px" caption="Preview queries for recording rules" >}}

### Wait before firing alerts when no data is returned

Alert rules that are configured to fire when an evaluation returns no data now only fire when the entire duration of the evaluation period has finished. This means that rather than immediately firing when the alert rule condition is breached, the alert rule waits until the time set in the For field has finished and then fires, reducing alert noise and allowing for temporary data availability issues.

### Improved Notification Policies view

Updates to the notification policies view make it easier to use and manage:

- View default policy and nested policies at a glance
- New tab for mute timings
- View alert instances for each policy
- View contact points and which integrations are configured for each policy
- View inherited properties on nested policies
- Search for label matchers and for contact points to see which notifications are going where

{{< figure src="/media/docs/alerting/notification-policies-view.png" max-width="750px" caption="Improved Notification Policies view" >}}

### Guidance for configuring your Alertmanager

Get additional help while configuring your Alertmanager. If you enter an invalid Alertmanager configuration, an error message displays, and you can choose from a previous working configuration to restart it.

## InfluxDB plugin database field deprecation

The `database` field in the provisioning file has been deprecated.
This information will be stored in `jsonData` with `dbName` field.
The `database` field will be removed in the future, to make InfluxDB consistent with other data sources.
For more information and examples please refer to the [InfluxDB Provisioning docs]({{< relref "../datasources/influxdb/#provision-the-data-source" >}}).

## Auth: Lock organization roles synced from auth providers

_Generally available in all editions of Grafana._

Grafana 9.4 provided the ability to configure synchronization of organization roles for each OAuth provider. When synchonization is switched on, the organization role would be applied to the user from the OAuth provider upon signing in. After signing in, during the session you can change the user’s organization role.

With this release, we are reinforcing organization role syncing behavior by introducing a new feature toggle called `onlyExternalOrgRoleSync`. Once enabled, users signing in to Grafana cannot change organization roles that have been synchronized from an external authentication provider, like Active Directory or Google Oauth. This can help ensure the right users maintain the right level of access at all times.

This feature should be used if you want to enforce strict role synchronization from your auth provider to the organization roles.

If you want to enable this feature, you'll need to enable the `onlyExternalOrgRoleSync` feature toggle. If you’re using Grafana Cloud and would like to enable this feature, please contact customer support. We will also be automatically enabling this feature for Grafana Cloud instances over the upcoming weeks.

You can also _prevent_ the synchronization of organization roles from a given authentication provider. For more information, refer to [skip org role sync]({{< relref "../setup-grafana/configure-grafana/#authgrafana_com-skip_org_role_sync/" >}}).
