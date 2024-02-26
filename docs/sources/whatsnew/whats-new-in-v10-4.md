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
weight: -40
---

# What’s new in Grafana v10.4

Welcome to Grafana 10.4! Read on to learn about changes to dashboard visualizations and alert rules.

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v10.4, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v10.4/).

<!-- Template below

## Feature
<!-- Name of contributor -->
<!--_[Generally available | Available in private/public preview | Experimental] in Grafana [Open Source, Enterprise, all editions of Grafana, some combination of self-managed and Cloud]_
Description. Include an overview of the feature and problem it solves, and where to learn more (like a link to the docs).
{{% admonition type="note" %}}
Use full URLs for links. When linking to versioned docs, replace the version with the version interpolation placeholder (for example, <GRAFANA_VERSION>, <TEMPO_VERSION>, <MIMIR_VERSION>) so the system can determine the correct set of docs to point to. For example, "https://grafana.com/docs/grafana/latest/administration/" becomes "https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/".
{{% /admonition %}}

<!--Add an image, GIF or video  as below-->

<!--{{< figure src="/media/docs/grafana/dashboards/WidgetVizSplit.png" max-width="750px" caption="DESCRIPTIVE CAPTION" >}}

<!--Learn how to upload images here: https://grafana.com/docs/writers-toolkit/write/image-guidelines/#where-to-store-media-assets-->
<!---->

## Dashboards and visualizations

### Set library panel permissions with RBAC

<!--#grafana-dashboards -->

_Generally available in Grafana Enterprise and Grafana Cloud_

We've added the option to manage library panel permissions through role-based access control (RBAC). With this feature, you can choose who can create, edit, and read library panels. RBAC provides a standardized way of granting, changing, and revoking access when it comes to viewing and modifying Grafana resources, such as dashboards, reports, and administrative settings.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/build-dashboards/manage-library-panels/)

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

## Alerting

### Grafana Alerting upgrade with rule preview

<!-- #alerting -->

_Generally available in all editions of Grafana_

Users looking to migrate to the new Grafana Alerting product can do so with confidence with the Grafana Alerting migration preview tool. The migration preview tool allows users to view, edit, and delete migrated rules prior cutting over, with the option to roll back to Legacy Alerting.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/migrating-alerts/#upgrade-with-preview-recommended)

### Rule evaluation spread over the entire evaluation interval

<!-- #alerting -->

_Generally available in all editions of Grafana_

Grafana Alerting previously evaluated rules at the start of the evaluation interval. This created a sudden spike of resource utilization, impacting data sources. Rule evaluation is now spread over the entire interval for smoother performance utilization of data sources.

### UTF-8 Support for Prometheus and Mimir Alertmanagers

<!-- #alerting -->

_Generally available in all editions of Grafana_

Grafana can now be used to manage both Prometheus and Mimir Alertmanagers with UTF-8 configurations. For more information, please see the release notes for Alertmanager 0.27.0.

### Simplified Alert Notification Routing

<!--#alerting -->

_Generally available in all editions of Grafana_

This feature simplifies your options for configuring where your notifications are sent when an alert rule fires. Choose an existing contact point directly from within the alert rule creation form without the need to label match notification policies.  You can also set optional muting, grouping, and timing settings directly in the alert rule.

Simplified routing inherits the alert rule RBAC, increasing control over notification routing while preventing accidental notification policy updates, ensuring critical notifications make it to their intended contact point destination.

To try out Simplified Alert Notification Routing enable the `alertingSimplifiedRouting` feature toggle.

## Authentication and authorization

### SSO Settings UI and Terraform resource for configuring OAuth providers

<!-- #proj-grafana-sso-config, #identity-access or Mihaly Gyongyosi (@Misi) -->

_Available in public preview in all editions of Grafana_

Configuring OAuth providers was a bit cumbersome in Grafana: Grafana Cloud users had to reach out to Grafana Support, self-hosted users had to manually edit the configuration file, set up environment variables, and then they had to restart Grafana. On Cloud, the Advanced Auth page is there to configure some of the providers, but configuring Generic OAuth hasn’t been available until now and there was no way to manage the settings through the Grafana UI, nor was there a way to manage the settings through Terraform or the Grafana API.

Our goal is to make setting up SSO for your Grafana instance simple and fast.

To get there, we are introducing easier self-serve configuration options for OAuth in Grafana. All of the currently supported OAuth providers are now available for configuration through the Grafana UI, Terraform and via the API. From the UI, you can also now manage all of the settings for the Generic OAuth provider.

We are working on adding complete support for configuring all other supported OAuth providers as well, such as GitHub, GitLab, Google, Microsoft Azure AD and Okta. You can already manage some of these settings via the new self-serve configuration options, and we’re working on adding more at the moment.

![Screenshot of the Authentication provider list page](/media/docs/grafana-cloud/screenshot-sso-settings-ui-public-prev-v10.4.png)
