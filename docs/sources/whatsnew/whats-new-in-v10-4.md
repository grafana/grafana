---
description: Feature and improvement highlights for Grafana v10.4
keywords:
  - grafana
  - new
  - documentation
  - '10.4'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v10.4
weight: -41
---

# What’s new in Grafana v10.4

Welcome to Grafana 10.4! This minor release contains some notable improvements in its own right, as well as early previews of functionality we intend to turn on by default in Grafana v11. Read on to learn about a quicker way to set up alert notifications, an all-new UI for configuring single sign-on, and improvements to our Canvas, Geomap, and Table panels.

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v10.4, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v10.4/).

<!-- Template below

## Feature
<!-- Name of contributor -->
<!--_[Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise, all editions of Grafana, some combination of self-managed and Cloud]_
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{< admonition type="note" >}}
Use full URLs for links. When linking to versioned docs, replace the version with the version interpolation placeholder (for example, <GRAFANA_VERSION>, <TEMPO_VERSION>, <MIMIR_VERSION>) so the system can determine the correct set of docs to point to. For example, "https://grafana.com/docs/grafana/latest/administration/" becomes "https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/".
{{< /admonition >}}

<!--Add an image, GIF or video  as below-->

<!--{{< figure src="/media/docs/grafana/dashboards/WidgetVizSplit.png" max-width="750px" caption="DESCRIPTIVE CAPTION" >}}

<!--Learn how to upload images here: https://grafana.com/docs/writers-toolkit/write/image-guidelines/#where-to-store-media-assets-->
<!---->

## Dashboards and visualizations

### AngularJS plugin warnings in dashboards

<!-- #grafana-deprecate-angularjs-->

_Generally available in all editions of Grafana_

AngularJS support in Grafana was deprecated in v9 and will be turned off by default in Grafana v11. When this happens, any plugin which depended on AngularJS will not load, and dashboard panels will be unable to show data.

To help you understand where you may be impacted, Grafana now displays a warning banner in any dashboard with a dependency on an AngularJS plugin. Additionally, warning icons are present in any panel where the panel plugin or underlying data source plugin has an AngularJS dependency.

This complements the existing warnings already present on the **Plugins** page under the administration menu.

In addition, you can use our [detect-angular-dashboards](https://github.com/grafana/detect-angular-dashboards) open source tool, which can be run against any Grafana instance to generate a report listing all dashboards that have a dependency on an AngularJS plugin, as well as which plugins are in use. This tool also supports the detection of [private plugins](https://grafana.com/legal/plugins/) that are dependent on AngularJS, however this particular feature requires Grafana v10.1.0 or higher.

Use the aforementioned tooling and warnings to plan migrations to React based [visualizations](https://grafana.com/docs/grafana/latest/panels-visualizations/) and [data sources](https://grafana.com/docs/grafana/latest/datasources/) included in Grafana or from the [Grafana plugins catalog](https://grafana.com/grafana/plugins/).

To learn more, refer to the [Angular support deprecation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/angular_deprecation/), which includes [recommended alternative plugins](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/angular_deprecation/angular-plugins/).

{{< youtube id="XlEVs6g8dC8" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/angular_deprecation/)

### Data visualization quality of life improvements

<!-- Nathan Marrs -->

_Generally available in all editions of Grafana_

We’ve made a number of small improvements to the data visualization experience in Grafana.

#### Geomap geojson layer now supports styling

You can now visualize geojson styles such as polygons, point color/size, and line strings. To learn more, [refer to the documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/geomap/#geojson-layer).

![Geomap marker symbol alignment](/media/docs/grafana/screenshot-grafana-10-4-geomap-geojson-styling-support.png)

#### Canvas elements now support snapping and aligning

You can precisely place elements in a canvas with ease as elements now snap into place and align with one another.

{{< video-embed src="/media/docs/grafana/screen-recording-10-4-canvas-element-snapping.mp4" caption="Canvas element snapping and alignment" >}}

#### View data links inline in table visualizations

You can now view your data links inline to help you keep your tables visually streamlined.

![Table inline datalink support](/media/docs/grafana/gif-grafana-10-4-table-inline-datalink.gif)

### Create subtables in table visualizations with Group to nested tables

<!-- Nathan Marrs -->

_Available in public preview in all editions of Grafana_

You can now create subtables out of your data using the new **Group to nested tables** transformation. To use this feature, enable the `groupToNestedTableTransformation` [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/#preview-feature-toggles).

{{< video-embed src="/media/docs/grafana/screen-recording-10-4-table-group-to-nested-table-transformation.mp4" caption="Group to nested tables transformation" >}}

### Set library panel permissions with RBAC

<!-- #grafana-dashboards -->

_Generally available in Grafana Enterprise and Grafana Cloud_

We've added the option to manage library panel permissions through role-based access control (RBAC). With this feature, you can choose who can create, edit, and read library panels. RBAC provides a standardized way of granting, changing, and revoking access when it comes to viewing and modifying Grafana resources, such as dashboards, reports, and administrative settings.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-library-panels/)

### Tooltip improvements

<!--Adela Almasan-->

_Available in public preview in all editions of Grafana_

We’ve made a number of small improvements to the way tooltips work in Grafana. To try out the new tooltips, enable the `newVizTooltips` [feature toggle](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

**Copy on click support**

You can now copy the content from within a tooltip by clicking on the text.

![Tooltip](/media/docs/grafana/gif-grafana-10-4-tooltip–copy.gif)

**Scrollable content**

You can now scroll the content of a tooltip, which allows you to view long lists. This is currently supported in the time series, candlestick, and trend visualizations. We'll add more improvements to the scrolling functionality in a future version.

![Tooltip](/media/docs/grafana/gif-grafana-10-4-tooltip-content-scroll.gif)

**Added tooltip options for candlestick visualization**

The default tooltip options are now also visible in candlestick visualizations.

**Hover proximity option in time series**

We've added a tooltip hover proximity limit option (in pixels), which makes it possible to reduce the number of hovered-over data points under the cursor when two datasets are not aligned in time.

![Time Series hover proximity](/media/docs/grafana/gif-grafana-10-4-hover-proximity.gif)

## Return to previous

<!-- #grafana-frontend-platform-->

_Available in public preview in all editions of Grafana_

When you're browsing Grafana - for example, exploring the dashboard and metrics related to an alert - it's easy to end up far from where you started and hard get back to where you came from. The ‘Return to previous’ button is an easy way to go back to the previous context, like the alert rule that kicked off your exploration. This first release works for Alerts, and we plan to expand to other apps and features in Grafana in future releases to make it easier to navigate around.

Return to Previous is rolling out across Grafana Cloud now. To try Return to Previous in self-managed Grafana, turn on the `returnToPrevious` [feature toggle](https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/) in Grafana v10.4 or newer.

{{< youtube id="-Y3qPfD2wrA" >}}

{{< admonition type="note" >}}
The term **context** refers to applications in Grafana like Incident and OnCall, as well as core features like Explore and Dashboards.

To notice a change in your context, look at Grafana's breadcrumbs. If you go from _Home > **Dashboards**_ to _Home > **Explore**_, you've changed context. If you go from _Home > **Dashboards** > Playlist > Edit playlist_ to _Home > **Dashboards** > Reporting > Settings_, you are in the same context.
{{< /admonition >}}

## Alerting

### Simplified Alert Notification Routing

<!-- #alerting -->

_Generally available in all editions of Grafana_

This feature simplifies your options for configuring where your notifications are sent when an alert rule fires. Choose an existing contact point directly from within the alert rule creation form without the need to label match notification policies.  You can also set optional muting, grouping, and timing settings directly in the alert rule.

Simplified routing inherits the alert rule RBAC, increasing control over notification routing while preventing accidental notification policy updates, ensuring critical notifications make it to their intended contact point destination.

To try out Simplified Alert Notification Routing enable the `alertingSimplifiedRouting` feature toggle.

{{< youtube id="uBBQ-_pWSNs" >}}

### Grafana Alerting upgrade with rule preview

<!-- #alerting -->

_Generally available in all editions of Grafana_

Users looking to migrate to the new Grafana Alerting product can do so with confidence with the Grafana Alerting migration preview tool. The migration preview tool allows users to view, edit, and delete migrated rules prior cutting over, with the option to roll back to Legacy Alerting.

[Documentation](https://grafana.com/docs/grafana/v10.4/alerting/set-up/migrating-alerts/#upgrade-with-preview-recommended)

### Rule evaluation spread over the entire evaluation interval

<!-- #alerting -->

_Generally available in all editions of Grafana_

Grafana Alerting previously evaluated rules at the start of the evaluation interval. This created a sudden spike of resource utilization, impacting data sources. Rule evaluation is now spread over the entire interval for smoother performance utilization of data sources.

### UTF-8 Support for Prometheus and Mimir Alertmanagers

<!-- #alerting -->

_Generally available in all editions of Grafana_

Grafana can now be used to manage both Prometheus and Mimir Alertmanagers with UTF-8 configurations. For more information, please see the
[release notes for Alertmanager 0.27.0](https://github.com/prometheus/alertmanager/releases).

## Authentication and authorization

### SSO Settings UI and Terraform resource for configuring OAuth providers

<!-- #proj-grafana-sso-config, #identity-access or Mihaly Gyongyosi (@Misi) -->

_Available in public preview in all editions of Grafana_

Configuring OAuth providers was a bit cumbersome in Grafana: Grafana Cloud users had to reach out to Grafana Support, self-hosted users had to manually edit the configuration file, set up environment variables, and then they had to restart Grafana. On Cloud, the Advanced Auth page is there to configure some of the providers, but configuring Generic OAuth hasn’t been available until now and there was no way to manage the settings through the Grafana UI, nor was there a way to manage the settings through Terraform or the Grafana API.

Our goal is to make setting up SSO for your Grafana instance simple and fast.

To get there, we are introducing easier self-serve configuration options for OAuth in Grafana. All of the currently supported OAuth providers are now available for configuration through the Grafana UI, Terraform and via the API. From the UI, you can also now manage all of the settings for the Generic OAuth provider.

We are working on adding complete support for configuring all other supported OAuth providers as well, such as GitHub, GitLab, Google, Microsoft Azure AD and Okta. You can already manage some of these settings via the new self-serve configuration options, and we’re working on adding more at the moment.

![Screenshot of the Authentication provider list page](/media/docs/grafana-cloud/screenshot-sso-settings-ui-public-prev-v10.4.png)

{{< youtube id="xXW2eRTbjDY" >}}

[Documentation](https://grafana.com/docs/grafana/next/setup-grafana/configure-security/configure-authentication/)

## Data sources

{{< admonition type="note" >}}
The following data sources are released separately from Grafana itself. They are included here for extra visibility.
{{< /admonition >}}

### PagerDuty enterprise data source for Grafana

<!-- #enterprise-datasources -->

_Generally available in Grafana Enterprise and Grafana Cloud_

PagerDuty enterprise data source plugin for Grafana allows you to query incidents data or visualize incidents using annotations.

{{< admonition type="note" >}}
Plugin is currently in a preview phase.
{{< /admonition >}}

You can find more information and how to configure the plugin in the [documentation](https://grafana.com/docs/plugins/grafana-pagerduty-datasource/latest/).

Screenshots:

{{< figure src="/media/docs/plugins/PagerDuty-incidents-annotation.png" caption="PagerDuty data source annotation editor" alt="PagerDuty data source annotation editor" >}}

{{< figure src="/media/docs/plugins/PagerDuty-incidents-real-life-example.png" caption="Incidents annotations from PagerDuty data source on a dashboard panel" alt="Incidents annotations from PagerDuty data source on a dashboard panel" >}}

{{< youtube id="dCklm2DaVqQ" >}}

### SurrealDB Data Source

<!-- #grafana-partner-datasources, @adamyeats-->

_Experimental in all editions of Grafana_

A SurrealDB data source has been [added to the Plugin Catalog](https://grafana.com/grafana/plugins/grafana-surrealdb-datasource/), enabling the integration of [SurrealDB](https://surrealdb.com/), a real-time, multi-model database, with Grafana's visualization capabilities. This datasource allows users to directly query and visualize data from SurrealDB within Grafana, using SurrealDB's query language.

The SurrealDB data source launches with just the basics today. You can write queries in SurrealQL using the built-in query editor, although many Grafana features like macros are not supported for now.

You can find more information and how to configure the plugin [on Github](https://github.com/grafana/surrealdb-datasource).

{{< figure src="/media/images/dashboards/surrealdb-dashboard-example.png" alt="Grafana dashboard using SurrealDB data source" >}}

[Documentation](https://grafana.com/grafana/plugins/grafana-surrealdb-datasource/)

## Table Visualization for Logs

<!-- #observability-logs -->

_Generally available in all editions of Grafana_

The table visualization for logs, announced in public preview for Grafana 10.3, is generally available in Cloud (all editions) and with Grafana 10.4.

New to the table visualization with 10.4:

- the ability to sort columns
- data type autodetection of fields
- autodetection and clean formatting of json fields

Try it out today!
