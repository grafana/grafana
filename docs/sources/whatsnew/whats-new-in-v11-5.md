---
description: Feature and improvement highlights for Grafana v11.5
keywords:
  - grafana
  - new
  - documentation
  - '11.5'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v11.5
weight: -47
---

<!-- vale GoogleWe = NO -->
<!-- vale We = NO -->

# What’s new in Grafana v11.5

Welcome to Grafana 11.5! ...

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v11.5, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v11.5/).

# What's new

## Grafana Cloud Migration Assistant

### Grafana Cloud Migration Assistant supports all plugins and Grafana Alerting

<!-- #wg-everyone-to-cloud -->

_Available in public preview in all editions of Grafana_

The Grafana Cloud Migration Assistant enables you to seamlessly migrate resources from your Grafana OSS/Enterprise instance to Grafana Cloud in just a few clicks. The Migration Assistant launched in Grafana 11.2, with initial support for dashboards, data sources, and folders.

We're excited to announce plugin migration support. You can now migrate any of the hundreds of plugins in the [plugins catalog](https://grafana.com/grafana/plugins/all-plugins/) using the assistant.

We've also made it possible to easily migrate your Grafana Alerting resources from your self-managed instance. Grafana Alerting is a widely used feature and has numerous configuration options. The Migration Assistant saves you time and makes it simple to copy your alerts to a Grafana Cloud instance within minutes.

Ready to make the move? Explore our [docs](https://grafana.com/docs/grafana-cloud/account-management/migration-guide/#grafana-cloud-migration-assistant) to learn more about the Cloud Migration Assistant today and begin your effortless transition to Grafana Cloud.

## Authentication and authorization

### OAuth and SAML session handling improvements

<!-- #identity-access, Mihaly Gyongyosi (@Misi) -->

_Available in public preview in all editions of Grafana_

We’ve improved how Grafana manages external sessions for OAuth and SAML, enhancing compatibility with identity providers that support session management.

Grafana can now reliably manage SAML external sessions (Identity Provider sessions) by using the `SessionIndex` attribute in the SAML assertion and the `NameID` attribute in the logout request. Previously, Grafana relied on the `Login` attribute as the `NameID` and did not include the `SessionIndex` in the logout request, which could result in users being logged out of all their applications/IdP sessions when logging out of Grafana.

To enable the improved session management for SAML:

1. If Single Logout is enabled, ensure that `Name identifier format` is set to a value that is persistent across sessions, such as `Persistent` or `EmailAddress`.
2. Enable the `improvedExternalSessionHandlingSAML` feature toggle.
3. After enabling the feature, users may need to log in again to establish a new session under the updated configuration.

You can find more info on setting up SAML Single Logout in the [Grafana documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/saml/#single-logout).

For OAuth, we’ve enhanced session management by linking external sessions to Grafana sessions. This includes better handling of access and refresh tokens, improving both the security and reliability of OAuth based authentication workflows.

The feature is behind the `improvedExternalSessionHandling` feature toggle and is disabled by default. Once enabled, users may need to log in again to establish a new session.

Both features will be enabled for all Grafana Cloud instances eventually.

## Dashboards and visualizations

### Redesigned sharing experience in Dashboards

<!-- #grafana-sharing -->

_Generally available in all editions of Grafana_

Introducing a redesigned sharing experience in Dashboards!

Previously, the way you shared dashboards could be confusing, with various options like **Link**, **Snapshot**, **Export**, **PDF**, **Report**, and **Public Dashboard** all in one dialog box. This approach didn't take into consideration one's specific sharing needs, leading to a suboptimal user experience.

The new solution simplifies the sharing process by categorizing these options in a more user-friendly and intuitive manner, inspired by well-designed platforms like Figma and Google Docs. The redesigned sharing model is leaner, easier to navigate, and more focused on your needs rather than just listing available features.

#### Prominent share call to action

The redesigned experience features a more visible and accessible **Share** button, which encourages more frequent use. This replaces the small and easily overlooked icon that launched the feature previously.

#### Simplified sharing flow

Sharing options are now grouped and presented based on common user needs, making it easier for you to find the right sharing method for your situation. Rather than having all of the sharing options in a common dialog box, they're organized into **Export** and **Share** drop-down lists:

![Dashboard export options](/media/docs/grafana/dashboards/screenshot-dashboard-export-v11.3.png)

![Dashboard sharing options](/media/docs/grafana/screenshot-dashboard-share-v11.3-2.png)

#### Adaptable and scalable

The redesign is also flexible, allowing for easy adaptation to different contexts (for example, panel sharing) and is capable of accommodating new sharing options as the product evolves.

#### Updated panel sharing

As part of this update, we've also redesigned the experience for sharing a panel. Now, when you open the panel actions menu, there are three sharing options:

- **Share a link** - For internal sharing with users in your organization.
- **Share an embed** - Allows you to embed the panel as an iframe.
- **Share a snapshot** - Allows you to share an interactive panel publicly, with sensitive data removed.

![Panel sharing options](/media/docs/grafana/dashboards/screenshot-panel-share-v11.3.png)

The option to create a library panel has been moved out of the sharing options, and is accessible under **More** in the panel actions menu when you're in edit mode.

To learn more about all of these changes, refer to the [Share dashboards and panels documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/), the [Shared dashboards documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/shared-dashboards/).

{{< video-embed src="/media/docs/grafana/dashboards/2024-09-25-The-Redesigned-Sharing-Feature-Enablement-Video.mp4" >}}

{{< docs/private-preview product="Sharing externally with specific people" >}}

### Redesigned filters for dashboards

<!-- #grafana-dashboards, Isabel Matwawana -->

_Generally available in all editions of Grafana_

We've redesigned dashboard filters for an improved filter creation experience!

The redesigned filters are more prominent in the dashboard and filters based on the same ad hoc filter variable are more clearly related. In the new design, you can click anywhere in the filter field to begin creating a one and Grafana automatically detects which part of the filter you're setting up. It takes fewer clicks to create a filter and the creation process using keyboard strokes is smoother than previously.

**Multi-select operators**
The most prominent update to the filters is that labels can have more than one value using the new multi-select operators.

{{< figure src="/media/docs/grafana/dashboards/filters-multi-select-v11.3.png" max-width="500px" alt="Multi-select operators" caption="Multi-select operators" >}}

{{< figure src="/media/docs/grafana/dashboards/filters-multi-selector-v11.3.png" max-width="600px" alt="Multiple values selected" caption="Multiple values selected" >}}

{{< figure src="/media/docs/grafana/dashboards/filters-selected-v11.3.png" max-width="600px" alt="Filter with multiple values" caption="Filter with multiple values" >}}

{{< admonition type="note" >}}
Multi-select operators only appear if supported by the filter data source.
{{< /admonition >}}

To try out the redesigned filters, enable the `newFiltersUI` feature flag.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#filter-dashboard-data)

### New regular expression option for Extract fields transformation

<!-- Leon Sorokin, #grafana-dataviz -->

_Generally available in all editions of Grafana_

We've updated the **Extract fields** transformation with an additional **RegExp** format option you can use to perform more advanced parsing of the selected field, such as extracting parts of strings or splitting content into multiple fields using [named capturing groups](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Named_capturing_group) like `/(?<NewField>.*)/`.

{{< figure src="/media/docs/grafana/panels-visualizations/screenshot-regexp-format-v11.3.png" max-width="600px" alt="Editing a panel with the RegExp format highlighted" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#extract-fields)

### PDF export improvements in GA

<!-- #grafana-sharing -->

_Generally available in Grafana Enterprise and Grafana Cloud_

In May 2024, we announced a [new way of generating PDFs](https://grafana.com/docs/grafana-cloud/whats-new/2024-05-13-pdf-export-improvements/) that introduced a major performance improvement for the PDF export feature. It also fixed all [caveats](https://grafana.com/docs/grafana/v11.4/dashboards/create-reports/#caveats) related to rendering a report with panels or rows set to repeat by a variable, like rendering repeating panels inside collapsed rows.

This new PDF generation method now replaces the old one and is generally available for everyone.

This feature will gradually roll out to all Grafana Enterprise and Grafana Cloud users over the next few weeks with no action required.

### Customizable shareable dashboard panel images

<!-- Juani Cabanas, #grafana-sharing -->

_Generally available in all editions of Grafana_

We've made some big changes to the panel image sharing experience. When you [share a panel link](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/#share-an-internal-link-1), there's a new **Panel preview** section where you can:

- Customize a panel image.
- See a preview of the panel image.
- Download and share the image without a URL.

You can customize the image by updating the width, height, and scale of it:

{{< figure src="/media/docs/grafana/dashboards/panel-image-preview.png" max-width="600px" alt="Panel sharing link settings with panel image preview" >}}

We've also updated the panel image sharing process. Previously, you clicked a button to render the image and then had to send that image URL to share it. Now, you click a button to generate the image and then simply download it and send that to other organization users.

## Data sources

### OpenSearch data source supports Private Data Source Connect (PDC)

<!-- #grafana-aws-datasources -->

_Generally available in all editions of Grafana_

Version 2.21.0 of the [Grafana OpenSearch plugin](https://grafana.com/grafana/plugins/grafana-opensearch-datasource/) introduces support for private data source connect (PDC).

[PDC](https://grafana.com/docs/grafana-cloud/connect-externally-hosted/private-data-source-connect/) is a way for you to establish a private, secured connection between a Grafana Cloud instance, or stack, and data sources secured within a private network. This makes it possible to take advantage of the convenience and power of Grafana Cloud, even if your OpenSearch cluster is hosted in a Virtual Private Cloud (VPC) or another private network.

### Time series macro support in visual query builder for SQL data sources

<!-- Zoltán Bedi -->

_Generally available in all editions of Grafana_

It is now possible to create time series queries from the query builder in the following data sources. MySQL, PostgreSQL, MS SQL. Use the **Data operations** drop-down to select a macro like `$__timeGroup` or `$__timeGroupAlias`.

Select a time column from the **Column** drop-down and a time interval from the **Interval** drop-down to create a time-series query.

{{< figure src="/media/docs/grafana/data-sources/screenshot-sql-builder-time-series-query.png" alt="SQL query builder time-series query" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/mysql/#macros)

### Elasticsearch cross-cluster search

<!-- #grafana-aws-datasources" -->

_Available in public preview in all editions of Grafana_

The Elasticsearch data source plugin now offers support for Elasticsearch's Cross-cluster Search feature.

If you’re a big Elasticsearch user, you might have multiple clusters set up for geographical separation, different teams or departments, compliance, or scaling reasons. Previously, you needed to set up a separate data source in Grafana for each cluster. Now with cross-cluster search, you can query data across all these clusters from a single Grafana data source. This makes it simpler and more convenient to query all of your Elasticsearch logs. You can learn more about this feature in the [Elasticsearch docs](https://www.elastic.co/guide/en/elasticsearch/reference/current/modules-cross-cluster-search.html).

To use this, it must be enabled in Elasticsearch ([docs](https://www.elastic.co/guide/en/cloud/current/ec-enable-ccs.html)) and enabled in Grafana with the `elasticsearchCrossClusterSearch` [feature toggle](https://grafana.com/docs/grafana/l<GRAFANA_VERSION>/setup-grafana/configure-grafana/feature-toggles/).

## Other

### Public dashboards are now Shared dashboards

<!-- #grafana-sharing -->

_Generally available in all editions of Grafana_

We've renamed the **Public dashboards** feature, **Shared dashboards**. This renaming is part of our overall redesign of dashboard sharing and aims to better align externally shared dashboards with other dashboard sharing options.

The feature still functions the same way, but the configuration options that were previously part of public dashboards are now found in the **Share externally** option in the **Share** drop-down list.

While several backend elements, such as API messages, remain the same, user interface labels and references have changed. You can find the updated documentation at [Externally shared dashboards](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/share-dashboards-panels/shared-dashboards/). Learn more about updated sharing feature in the [Redesigned sharing experience in Dashboards announcement](https://grafana.com/docs/grafana-cloud/whats-new/2024-09-25-redesigned-sharing-experience-in-dashboards/).

### Reporting theme options

<!-- #grafana-sharing -->

_Generally available in Grafana Enterprise and Grafana Cloud_

**Introducing theme options for Reporting**

Admins can now choose independent light or dark themes for the PDF attachment and embedded dashboard image in reports. Selected theme options are applied to PDFs and embedded images for all reports within the organization.

In addition to adding these theme options, we've also renamed the **Report branding** section of the settings page to **Attachment settings**, so that the application of the settings is clearer.

{{< figure src="/media/docs/grafana/dashboards/screenshot-theme-options-v11.3.png" max-width="450px" alt="Reporting settings with theme options highlighted" >}}

You can set these options under **Dashboards > Reporting > Settings**.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/create-reports/#report-settings)

## Plugins

### Plugin Frontend Sandbox

<!-- #grafana-plugins-platform -->

_Available in public preview in all editions of Grafana_

The Plugin Frontend Sandbox is a security feature that isolates plugin frontend code from the main Grafana application. When enabled, plugins run in a separate JavaScript context, which provides several security benefits:

- Prevents plugins from modifying parts of the Grafana interface outside their designated areas
- Stops plugins from interfering with other plugins functionality
- Protects core Grafana features from being altered by plugins
- Prevents plugins from modifying global browser objects and behaviors

Plugins running inside the Frontend Sandbox should continue to work normally without any noticeable changes in their intended functionality.

We are currently rolling this functionality, which is disabled by default, to our cloud and on-prem customers. Please [read the documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/plugin-management/#enable-frontend-sandbox) on how to enable and use the sandbox on your instance.
