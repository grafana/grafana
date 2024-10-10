---
description: Feature and improvement highlights for Grafana v11.3
keywords:
  - grafana
  - new
  - documentation
  - '11.3'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v11.3
weight: -45
---

<!-- vale GoogleWe = NO -->
<!-- vale We = NO -->

# What’s new in Grafana v11.3

Welcome to Grafana 11.3! In this release, we've made a number of significant updates and improvements. Scenes-powered dashboards are now generally available and the Explore Logs plugin is now installed by default. The dashboard experience has also improved in other ways including the ability to trigger API calls from any canvas element with the new **Actions** option and an update to transformations so you can apply calculations to dynamic fields. We've also simplified the alert setup experience, added customizable announcement banners, and added role-based access to plugins.

<!-- {{< youtube id="s6IYpILVDSM" >}} -->

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v11.3, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v11.3/).

## Scenes-powered Dashboards is generally available

<!-- #grafana-dashboards -->

_Generally available in all editions of Grafana_

For the past few months we've been working on a major update of our **Dashboards** architecture and migrated it to the Scenes library. This migration provides us with more stable, dynamic, and flexible dashboards as well as setting the foundation for what we envision the future of Grafana dashboards will be. Here are four of the improvements that are being introduced as part of this work:

**Edit mode**

It can be difficult to efficiently navigate through the visually cluttered options during the dashboard editing process. With the introduction of the edit mode, we aim to provide an easier way to discover and interact with the dashboard edit experience.

**Fixed positioning of template variables and time picker**

We moved the time picker into the dashboard canvas and now, together with template variables, it will stick to the top as you scroll through your dashboard. This has historically been a very [requested feature](https://github.com/grafana/grafana/issues/11166) that we're very happy to be able to finally roll out!

**Timezone parameter in Grafana URL**

We've added a new URL parameter `tz`. This allows sharing dashboards with a selected time zone, ensuring that the receiver views it in the intended time zone regardless of their local settings.

**Kiosk mode displays dashboard controls**

When playing a playlist or displaying a dashboard in full screen, controls are now shown by default. These controls include the time and refresh picker, variables, annotations, and links.

If you prefer to hide these controls during playlist playback, new configuration options are available when starting a playlist. You can choose which controls to display while the playlist is running.

For configuring controls outside of playlist playback, you can use the following URL parameters:

- `_dash.hideTimePicker`: Hides the time and refresh picker
- `_dash.hideVariables`: Hides variables and annotations controls
- `_dash.hideLinks`: Hides dashboard links

### Known limitations

- The [variable usage check](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/inspect-variable/) is not yet available.
- Editing a panel:

  - The **Library panels** tab is not available anymore. You can replace a library panel from the panel menu.
  - The **Overrides** tab is missing in panel options (coming in Grafana v11.3.0). Overrides are shown at the bottom of the option list.
  - The drop-down to collapse the visualization picker is missing (coming in Grafana v11.3.0).

- Share button is not visible when edit mode is enabled (coming in Grafana v11.3.0).

If you want to learn more, in detail, about all the improvements we've made, don't miss our blog post.

{{< youtube id="kcKwBhvrsHc" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/)

## Dashboards and visualizations

### Improved cell inspect in tables

<!-- Kyle Cunningham, Isabel Matwawana -->

_Generally available in all editions of Grafana_

We've improved the inspect value experience in table visualizations with the addition of tabs in the **Inspect value** drawer: **Plain text** and **Code editor**.

When the **Cell inspect value** switch is toggled on, clicking the inspect icon in a cell opens the drawer. Grafana attempts to automatically detect the type of data in the cell and opens the drawer with the associated tab showing. However, you can switch back and forth between tabs.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-cell-inspect-11.3.png" max-width="650px" alt="Inspect value drawer opened to Plain text tab" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/table/#cell-value-inspect)

### Canvas actions

<!-- Adela Almasan, #grafana-dataviz -->

_Experimental in all editions of Grafana_

We've updated canvas visualizations so that now you can add actions to canvas elements. The **Selected element** configuration now includes a **Data links and actions** section where you can add actions to elements. Each action can be configured to call an API endpoint.

Actions can also be configured to be triggered with a single click. To enable this functionality, select **Action** under the one **One-click** section in the **Selected element** data links and actions option. If there are multiple actions for an element, the first action in the list has the one-click functionality.

Also, we've also added the ability to control the order in which actions are displayed in the tooltip by dragging and dropping them.

{{< video-embed src="/media/docs/grafana/panels-visualizations/canvas-actions-11.3.mp4" >}}

To try out this feature, enable the `vizActions` feature toggle.

### Legend support in bar gauge visualizations

<!-- Adela Almasan, #grafana-dataviz -->

_Generally available in all editions of Grafana_

We've added legend support to bar gauge visualizations. You can customize legends by navigating to the **Legend** section in panel options. By default, the legend is disabled.

To better support the legend integration, we've added the ability to hide names in each bar gauge. To do that, in the **Name placement** option, choose **Hidden**.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-bargauge-legend1-11.3.png" alt="Bar gauge legend" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/bar-gauge/#legend-options)

### All number fields for Binary operation transformation

<!-- Drew Slobodnjak; #grafana-dataviz -->

_Generally available in all editions of Grafana_

We've made a helpful update to the **Binary operation** mode of the **Add field from calculation** transformation!

When you set up a binary operation calculation, there's a new **All number fields** option available to select. Use this to apply a mathematical operator to multiple number fields simultaneously. This feature is particularly useful when you're scaling or offsetting data containing multiple, dynamically named fields, allowing the transformation to be applied when dealing with unknown field names.

{{< figure src="/media/docs/grafana/transformations/screenshot-grafana-11-3-all-number-fields-binary-operation.png" max-width="650px" alt="Binary operation calculation being applied to all number fields" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#add-field-from-calculation)

## Explore Logs

### Explore Logs plugin installed by default

<!-- #proj-explorelogs-dev -->

_Generally available in all editions of Grafana_

**Explore Logs** is a plugin that lets you automatically visualize and explore your logs without having to write queries. It makes finding spikes in your log volume, filtering your logs and pinpointing problematic log lines a lot easier and more smooth.

While **Explore Logs** is [GA in cloud](https://grafana.com/blog/2024/09/24/queryless-metrics-logs-traces-profiles/#explore-logs) and installed by default already, with Grafana v11.3.0 it will be automatically installed on your on-prem instance as well. This will let you use Explore Logs alongside **Explore Metrics**.

This is configured by the [`preinstall` configuration parameter](https://github.com/grafana/grafana/blob/9ece88d5852dceb90f83271e66902eece24f908f/conf/defaults.ini#L1748) in your Grafana configuration. For more information about Explore logs, refer to [the documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/simplified-exploration/logs/).

## Alerting

### Simplified query section for alert rule creation

<!-- Sonia Aguilar -->

_Generally available in all editions of Grafana_

Introduces a simplified version of the query and alert conditions step for creating Grafana-managed alert rules. The default options streamline rule creation with a cleaner header and a single query and condition. For more complex rules, switch to advanced options to add multiple queries and expressions.

This feature is rolling out to Grafana Cloud over the next couple of weeks.

Grafana Enterprise and OSS:

To use this feature, enable the `alertingQueryAndExpressionsStepMode` feature toggle.

{{< figure src="/media/docs/alerting/simple-query-form.png" max-width="700px" alt="Image shows the alert creation form in simple mode" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/create-grafana-managed-rule/)

## Data sources

### GitHub App authentication for the GitHub data source

<!-- #grafana-oss-big-tent -->

_Generally available in all editions of Grafana_

You can now authenticate the GitHub data source using a GitHub App, providing an alternative to personal access tokens (PATs). GitHub App authentication offers enhanced security by granting more granular permissions, reducing the risk of over-permissioning.

For more information, refer to the [GitHub data source documentation](https://grafana.com/docs/plugins/grafana-github-datasource/latest/setup/token/#using-github-app-authentication) for detailed instructions on setting up GitHub App authentication.

[Documentation](https://grafana.com/docs/plugins/grafana-github-datasource/latest/)

## OnCall

### Improved onboarding for OnCall users

<!-- #gops-irm -->

_Generally available in all editions of Grafana_

We've streamlined the onboarding process for OnCall, making it quicker and easier for new users to get started.

Now, new users can access OnCall immediately without waiting for an admin to log in. OnCall initialization has been moved to the backend, reducing setup time and minimizing potential errors. Additionally, user synchronization between Grafana and OnCall is significantly faster, so newly created users can start using OnCall within minutes—without any delays or extra steps.

### Manual trigger for webhooks

<!-- #gops-irm -->

_Generally available in all editions of Grafana_

Webhooks are a useful and flexible way to interact with third-party services. While OnCall has supported advanced webhook integrations for some time, they were previously limited to automatic triggers, such as event-based triggers (e.g., alert group status changes) or escalation chain steps.

Now, you can manually trigger webhooks within the context of an alert group. This new feature enables you to push alert group data to external systems on demand, giving you greater flexibility and control over your integrations.

{{< figure src="/static/img/oncall/screenshot-oncall-trigger-webhook.png" >}}

## Announcement banner

<!-- #grafana-frontend-platform -->

_Available in public preview in Grafana Enterprise and Grafana Cloud_

Grafana admins struggle to effectively communicate important updates and maintenance information to their users through traditional channels like email and Slack. Customers have requested a feature to display customizable banners within the Grafana interface to ensure critical information is visible and timely.

The announcement banner feature directly addresses the communication challenges faced by Grafana admins by allowing them to display critical information prominently within the Grafana interface. This ensures that all users are immediately informed of important updates, maintenance schedules, compliance info, or other crucial messages, reducing the likelihood of missed communications and enhancing overall user awareness and engagement.

By default, only organization administrators can create announcement banners. You can customize who can create announcement banners with [Role-based access control](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/roles-and-permissions/access-control/).

To use the Announcement banner in self-managed Grafana, turn on the `notificationBanner` [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/) in Grafana v11.3 or newer.

{{< figure src="/media/docs/grafana/grafana-announcement-banner.png" max-width="650px" caption="Announcement banner configuration page." alt="Announcement banner configuration page" >}}

## Improved subfolder creation flow

<!-- #identity-access -->

_Generally available in all editions of Grafana_

You can now create subfolders in folders where you have Edit or Admin rights without needing any additional permissions. This enables users and teams to fully manage their folder and dashboard hierarchy, and allows you to keep your instance secure by granting users the minimum necessary set of permissions.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/manage-dashboards/#create-a-dashboard-folder)

## Plugins

### Plugin details page redesign

<!-- #grafana-plugins-platform -->

_Available in public preview in all editions of Grafana_

To help make it easier for administrators to assess and interact with Grafana plugins, we are reworking the plugin details page to highlight important metadata, such as when the plugin was last updated.

We intend to further extend this new layout with consistent links for all plugins, to complement the custom links which can currently be optionally configured. This improved consistency will enable simpler interaction with a plugin's developer - whether that is Grafana Labs, our commercial partners, or our community. These links will include actions such as raising feature requests or bug reports, as well as allowing our community developers to indicate available support and sponsorship options for those that depend on their work.

## Authentication and authorization

### Setup LDAP through the UI

<!-- #proj-grafana-sso-config -->

_Available in public preview in all editions of Grafana_

{{< figure src="/media/docs/grafana/2024-10-04-sso_ldap_2.png" max-width="700px" alt="Advanced LDAP settings" >}}

At Grafana, we're comminited to ease of use, and we've now introduced a new screen to set up your LDAP server as an Identity Provider.

The new user interface makes it much clearer what each option does, and setting up the various configurations is now more transparent. Also, you no longer need to restart the Grafana instance for the new settings to take effect.

This feature is available in Public Preview by enabling the feature toggle `ssoSettingsLDAP`.

### RBAC for Plugins

<!-- Gabriel Mabille -->

_Generally available in all editions of Grafana_

[Documentation](https://grafana.com/developers/plugin-tools/reference-plugin-json#roles)

We're excited to announce that plugins can now leverage [Grafana's role based access control](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/access-control/#about-rbac) to define their own roles and permissions in order to control access to their routes.

To define roles and their default assignments, plugin developers need to add a `roles` section to their `plugin.json` file. Grafana will automatically register these roles and assign them to the corresponding basic roles: `Viewer`, `Editor`, `Admin`, and `Grafana Admin`.

Following is an example of defining two RBAC plugin roles and assigning them to Admins and Viewers (and thus Editors and Admins) by default:

```json
"roles": [
  {
    "role": {
      "name": "Patents Reader",
      "description": "Read patents",
      "permissions": [
        {"action": "grafana-appwithrbac-app.patents:read"}
      ]
    },
    "grants": ["Admin"]
  },
  {
    "role": {
      "name": "Research papers Reader",
      "description": "Read research papers",
      "permissions": [
        {"action": "grafana-appwithrbac-app.papers:read"}
      ]
    },
    "grants": ["Viewer"]
  }
]
```

Protecting `includes` and `routes` is also straight forward, and can be done through the new `action` and `reqAction` field of these sections of the `plugin.json` file.

**Plugin example**

If you’d like to test this and explore RBAC for plugins further, refer to this [plugin example](https://github.com/grafana/grafana-plugin-examples/blob/main/examples/app-with-rbac/README.md) for guidance.

**Known limitation**

Plugins permissions are currently restricted to actions without scopes.
