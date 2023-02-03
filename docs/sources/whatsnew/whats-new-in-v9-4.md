---
aliases:
  - /docs/grafana/latest/guides/whats-new-in-v9-4/
description: Feature and improvement highlights for Grafana v9.4
keywords:
  - grafana
  - new
  - documentation
  - '9.4'
  - release notes
title: What's new in Grafana v9.4
weight: -33
---

# What’s new in Grafana v9.4

Welcome to Grafana 9.4! Read on to learn about [add short list of what's included in this release]. For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).


## Alert email templating

We've improved the design and functionality of email templates to make template creation much easier and more customizable. The email template framework utilizes MJML to define and compile the final email HTML output. Sprig functions in the email templates provide more customizable template functions.

{{< figure src="/static/img/docs/alerting/alert-templates-whats-new-v9.3.png" max-width="750px" caption="Email template redesign" >}}

## Log details redesign

The details section of a log line has been updated. Previously some of the interactions, such as filtering, showing statistics or toggling the visibility were split across "Labels" and "Detected fields". With the recent changes those two sections were unified into one and the interactions are available for all fields.

{{< figure src="/static/img/logs/log-details-whats-new-9-4.png" max-width="750px" caption="Log details redesign with interactions" >}}

## Service account expiration dates

We have included a new configuration option, disabled by default. This will allow us to require an expiration date limit for all newly created service account tokens.

This will not affect existing tokens, however newly created tokens will require an expiration date that doesn't exceed the configuration option `token_expiration_day_limit`.

## OAuth providers setting for skip org role sync

Grafana integrates with different auth providers and have a demand for specific providers to skip syncronization for their organization roles. This option is now available for user who want to be able to manage their org roles from Grafana itself.

This option allows you to skip syncronization from your configured OAuth provider specifically in the auth provider section under `skip_org_role_sync`. Previously users could only do this for certain providers using the `oauth_skip_org_role_sync_update` option, but this would include all of the configured providers.

## RBAC support for Grafana OnCall plugin

We're rolling out RBAC support to Grafana plugins, with Grafana OnCall being the first plugin to fully support RBAC.
Previously Grafana OnCall relied on the Grafana basic roles (eg. Viewer, Editor, and Admin) for authorization within
the plugin.

Before RBAC support in Grafana OnCall, it was only possible to allow your organization's users to either view everything,
edit everything, or be an admin (which allowed edit access plus a few additional behaviours). With this new functionality,
organizations will be able to harness fine-grained access control within Grafana OnCall.

For example, you could assign a user in your organization, whom has the Viewer basic role (note that a user must still
have a basic role assigned) the new Grafana OnCall RBAC role of "Schedules Editor". This would allow the user to view
everything in Grafana OnCall, and also allow them to edit OnCall Schedules

## SAML auto login

We've added auto-login support for SAML authentication, which you can turn on with the `auto_login` configuration option. We also
have a unified configuration style among all authentication providers. Instead of using
`oauth_auto_login`, use the new `auto_login` option to enable automatic login for specific OAuth providers.

## Loki datasource query validation

We added support to validate queries and visually display errors as a query is being written, without having to execute it to receive this feedback. This feature supports single and multi-line queries, with and without variables.

{{< figure src="/media/docs/grafana/logs-loki-query-validation-whats-new-9-4.png" max-width="750px" caption="Loki query validation" >}}

## Loki logs sample in Explore

For Loki metric queries in Explore, you are now able to see the sample of log lines that contributed to the displayed results. To see these logs, click on the collapsed "Logs sample" panel under your graph or table panel. If you would like to interact with your log lines or modify the log query, click on the "Open logs in split view" button and the log query will be executed in the split view.

{{< figure src="/media/docs/grafana/logs-sample-whats-new-9-4.png" max-width="750px" caption="Logs sample in Explore" >}}

## New data source connection page in Dashboards and Explore

When you start your journey to create a dashboard or explore your data, but you don't have a data source connected yet, you’ll be shown a page that tells you this and guides you to set up a first connection.

Administrators can choose between selecting one of the most popular data sources or viewing the full list of them. Editors are guided to contact their administrator to configure data sources. In both cases, there's also an option to continue without setting up a data source and to use sample data instead.

This is currently a beta feature that can be accessed by enabling the `datasourceOnboarding` feature toggle.

{{< figure src="/media/docs/grafana/screenshot-datasource-connection-onboarding-whats-new-9-4.png" max-width="750px" caption="Admin view of data source connection page on dashboard creation" >}}

## Alerting: alert rules

We've made the following changes to alert rules

### Declare incidents from firing alerts

Declare an incident from a firing alert, streamlining the alert to incident workflow.

### Make copies of alert rules and notification templates

To help you reuse existing alert rules or templates, make copies of alert rules from the Alert rule list view and templates from the Contact points page.

### View query definitions for provisioned alerts

View read-only query definitions for provisioned alerts from the Alert rule details page. Check quickly if your alert rule queries are correct, without diving into your "as-code" repository for rule definitions.

### Export alert rules to use in the provisioning API or files

Create and tune an alert rule in the UI, then export to YAML or JSON, and use it in the provisioning API or files. You can also export an entire rule group to review or use. This is supported in both the UI and provisioning API.

### Pause alert rule evaluation

Pause alert rule evaluation to prevent noisy alerting while tuning your alerts. Pausing stops alert rule evaluation and does not create any alert instances. This is different to mute timings, which stop notifications from being delivered, but still allow for alert rule evaluation and the creation of alert instances.

![Pause alert rule evaluation](/media/docs/alerting/pause-alerts.png)

### View evaluation interval on the Group view

View the evaluation interval more easily from the grouped view on the Alert list page. The view now also always displays recording and normal alert rules and highlights alert rule status in different colors.

### Improved search for your alert rules

When managing large volumes of alerts, use extended alert rule search capabilities to filter on folders, evaluation groups, and rules. Additionally, you can filter alert rules by their properties like labels, state, type, and health.

### Adjust the amount and resolution of data used in your alerting queries

Lower costs and improve performance by adjusting the maximum number of data points returned from your alerting queries.

### Edit alert rule evaluation interval

Simplifies editing the evaluation interval for an alert rule within a new group. You no longer have to save the alert rule and group before editing the evaluation interval.

## Alerting: contact points

### View Grafana OnCall contact point

Connecting your OnCall workflows just got easier. OnCall has been added as a contact point to simplify the integration between alert notifications and your OnCall implementation.

### Add support for Discord as a contact point receiver

Adds Discord as a contact point receiver for Grafana Cloud alert rules.

## Alerting: administration

### Better guidance to configure your Alertmanagers

Get additional help while configuring your Alertmanager. If you enter an invalid Alertmanager configuration, an error message displays, and you can choose from a previous working configuration to restart it.

### Alerting landing page

Introduces a new landing page that helps you get started quickly with Alerting. It also provides you with at a glance information on how Alerting works and a video to introduce you to key concepts.

### Compatibility with AWS Aurora

Grafana Alerting is now compatible with AWS Aurora, but does not provide technical support for it.

## Command palette enhancements

The command palette has been updated to provide a more efficient way to navigate Grafana. Now you can search and access all pages as well as recent dashboards, making it easier to perform tasks without taking your hands off the keyboard.

Use the keyboard shortcut cmd + K on Mac or ctrl + K on Linux/Windows to launch the command palette.

Read more about using the command palette [in the documentation.](https://grafana.com/docs/grafana/latest/search/)

{{< figure src="/media/docs/grafana/screenshot-grafana-94-command-palette.png" max-width="750px" caption="Grafana command palette" >}}

## New navigation

Generally available on Grafana Cloud

The navigation in Grafana has been updated with a new design and an improved structure to make it easier for you to access the data you need. With this update, you'll be able to quickly navigate between features, giving you full visibility into the health of your systems.

The new navigation is gradually rolling out to all users on Grafana Cloud. If you’re using Grafana Open Source and Enterprise, you can enable this feature using the `topnav` feature toggle.

_Note:_ The Grafana documentation has not yet been updated to reflect changes to the navigation.

{{< figure src="/media/docs/grafana/navigation-9-4.png" max-width="750px" caption="Grafana new navigation" >}}

## Auditing and Usage Insights: Support for Loki multi-tenancy

_This feature is available for Enterprise customers_
This feature adds support to push analytics events and auditing logs to Loki with multi-tenancy mode, by specifying a tenant id.

## Reporting: Enable changing the report scale factor

_This feature is available for Enterprise customers_
Scale factor is a new feature for reports that allows users to change the dimension of the panels of the PDF document. It allows you to show more columns in the tables zooming out or show panels bigger zooming in.
You can modify the scale factor for each report in the report editor and/or when you share the whole PDF directly from the dashboard page.

{{< figure src="/media/docs/grafana/FormatReportScheduler9.4.png" max-width="750px" caption="Scale factor feature in Report format page" >}}

{{< figure src="/media/docs/grafana/FormatReportShare9.4.png" max-width="750px" caption="Scale factor feature in Share functionality" >}}

## Dashboard panel redesign

Dashboard panels hold a lot of information, some of which is difficult to discover or access entirely from the dashboard itself. With our redesigned panels, we've improved accessibility and made it easier to understand the status of a panel by adding and moving key elements.

We’ve rethought the panel information architecture, added additional interaction points, and reduced visual clutter. To start, we’ve improved the support of panels without a header, made a distinction between details set by you and data-induced information, and then included all essential components in the header of the panel. All of these are laid out from left to right in a row, so there are no overlapping, unusable components.

Grafana’s new panel is available only for React-based panels; no Angular-based panels will have the redesign (i.e., they’ll have the old Graph and Table visualizations).

{{< video-embed src="/media/docs/grafana/screen-recording-panel-header-redesign-whats-new-9-4.mp4>" >}}

However, we have more planned: we’re going to make even more improvements to the accessibility of panels and improvements to panels without a header.

This is a beta feature, which you can access by enabling the `newPanelChromeUI` feature toggle.
