---
description: Feature and improvement highlights for Grafana v11.2
keywords:
  - grafana
  - new
  - documentation
  - '11.2'
  - release notes
labels:
products:
  - cloud
  - enterprise
  - oss
title: What's new in Grafana v11.2
weight: -44
---

<!-- vale GoogleWe = NO -->
<!-- vale We = NO -->

# What’s new in Grafana v11.2

Welcome to Grafana 11.2!

For even more detail about all the changes in this release, refer to the [changelog](https://github.com/grafana/grafana/blob/main/CHANGELOG.md). For the specific steps we recommend when you upgrade to v11.2, check out our [Upgrade Guide](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/upgrade-guide/upgrade-v11.2/).

## Dashboards and visualizations

### Improvements in canvas visualizations

<!-- Adela Almasan, Nathan Marrs, #grafana-dataviz -->

_Generally available in all editions of Grafana_

### Standardized tooltips

As a continuation of our efforts to standardize tooltips across visualizations, we've updated canvas visualization tooltips to be supported for all elements tied to data. Besides the element name and data, the tooltip now also displays the timestamp. This is a step forward from the previous implementation where tooltips were shown only if data links were configured.

### Data links improvements

We've updated canvas visualizations so that you can add data links to canvas elements without using an override. The **Selected element** configuration now includes a **Data links** section where you can add data links to elements using the same steps as in other visualizations.

Data links in canvas elements can also be configured to open with a single click. To enable this functionality, select **Link** under the one **One-click** section in the **Selected element** data link options. If there are multiple data links for an element, the first link in the list has the one-click functionality.

As part of this improvement, we've also added the ability to control the order in which data links are displayed by dragging and dropping them. This improvement has been added to all visualizations.

{{< video-embed src="/media/docs/grafana/panels-visualizations/canvas-oneclick-tooltips-v4-11.2.mp4" >}}

In future releases, we'll add one-click functionality to data links in other Grafana visualizations.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/canvas/#data-links)

### Transformation updates

<!-- Nathan Marrs; #grafana-dataviz -->

_Generally available in all editions of Grafana_

We've made a number of exciting updates to transformations!

**You can now use variables in some transformations**

Template variables are now supported for the **Limit**, **Sort by**, **Filter data by values**, **Grouping to matrix** ([a community contribution](https://github.com/grafana/grafana/pull/88551) ⭐️), **Heatmap**, and **Histogram** transformations. This enables dynamic transformation configurations based on panel data and dashboard variables.

**New transpose transformation**

We're excited to announce the new transpose transformation, which allows you to pivot the data frame, converting rows into columns and columns into rows. This feature is particularly useful for data sources that don't support pivot queries, enabling more flexible and insightful data visualizations.

For more information, refer to the [documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#transpose).

{{< figure src="/media/docs/grafana/transformations/screenshot-grafana-11-2-transpose-transformation.png" alt="Transpose transformation in action" >}}

This feature is [a community contribution](https://github.com/grafana/grafana/pull/88963) ❤️

**Group to nested tables is now generally available**

We're excited to announce that the **Group to nested tables** transformation is now generally available! Easily group your table data by specified fields and perform calculations on each group. With this transformation, you can enhance the depth and utility of your table visualizations.

See [the documentation for more information](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#group-to-nested-tables).

{{< video-embed src="/media/docs/grafana/screen-recording-10-4-table-group-to-nested-table-transformation.mp4" caption="Group to nested tables transformation" >}}

**Format string is now generally available**

The **Format string** transformation is now generally available! Use this transformation to customize the output of a string field. From formatting your string data to upper, lower, title case, and more, this transformation provides a convenient way to standardize and tailor the presentation of string data for better visualization and analysis. See [the documentation for more information](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#format-string).

**New cumulative and window calculations available in Add field from calculation**

The **Add field from calculation** transformation now supports both cumulative and window calculations. The cumulative function calculates on the current row and all preceding rows. You can calculate the total or the mean of your data up to and including the current row. With the window function you can calculate the mean, standard deviation, or variance on a specified set (window) of your data. The window can either be trailing or centered. With a trailing window the current row will be the last row in the window. With a centered window the window will be centered on the current row.

See [the documentation for more information](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/query-transform-data/transform-data/#add-field-from-calculation).

### State timeline supports pagination

<!-- #grafana-dataviz -->

_Generally available in all editions of Grafana_

The state timeline visualization now supports pagination. The **Page size** option lets you paginate the state timeline visualization to limit how many series are visible at once. This is useful when you have many series. Previously, all the series in a state timeline were made to fit within the single window of the panel, which could make it hard to read.

{{< video-embed src="/media/docs/grafana/panels-visualizations/screen-recording-grafana-11-2-state-timeline-pagination-dark.mp4" >}}

With paginated results, the visualization displays a subset of all series on each page.

Pagination is especially useful if you're running a query on a dynamic data source. It's also helpful regardless of whether you have many data frames with just two fields (time + value) or few frames with many fields (time + many values).

This feature is [a community contribution](https://github.com/grafana/grafana/pull/89586) ❤️

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/state-timeline/#page-size-enable-pagination)

## Alerting

### Centralized alert history page

<!-- Ryan Kehoe, Sonia Alguilar -->

_Generally available in all editions of Grafana_

View a history of all alert events generated by your Grafana-managed alert rules from one centralized page. This helps you see patterns in your alerts over time, observe trends, make predictions, and even debug alerts that might be firing too often.

An alert event is displayed each time an alert instance changes its state over a period of time. All alert events are displayed regardless of whether silences or mute timings are set, so you’ll see a complete set of your data history even if you’re not necessarily being notified.

For Grafana Enterprise and OSS users:

To try out the new alert history page, enable the alertingCentralAlertHistory feature toggle and [configure Loki annotations](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/configure-alert-state-history/).

{{< figure src="/media/docs/alerting/alert-state-history.png" >}}

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/view-state-health/)

## Explore

### Logs filtering and pinning in Explore content outline

<!-- Haris Rozajac -->

_Generally available in all editions of Grafana_

<!-- Fix availability tags in WNIC-->

Grafana Explore now allows for logs filtering and pinning in content outline.

**Filtering Logs:** All log levels are now automatically available in the content outline. You can filter by log level, currently supported for Elasticsearch and Loki data sources. To select multiple filters, hold down the command key on Mac or the control key on Windows while clicking.

**Pinning Logs:** The new pinning feature allows users to pin logs to the content outline, making them easily accessible for quick reference during investigations. To pin a log, hover over a log in the logs panel and click on the _Pin to content outline_ icon in the log row menu. Clicking on a pinned log will open the log context modal, showing the log highlighted in context with other logs. From here, you can also open the log in split mode to preserve the time range in the left pane while having the time range specific to that log in the right pane.

## Data sources

### Cloudwatch Metric Insights cross account observability support

<!-- #grafana-aws-datasources -->

_Generally available in all editions of Grafana_

We are excited to announce support for cross-account querying in Metric Insights query builder for AWS Cloudwatch Plugin. This enables building SQL queries to monitor across multiple accounts in the same region in AWS Cloudwatch.
This feature introduces an account dropdown for selecting one or all of your source accounts and builds a query that targets them. Furthermore, results can be grouped by account ID by selecting "Account ID" in the Group By dropdown.
For more complex queries that are not covered by the options in the builder you can switch to the manual Code editor and edit the query.
To set up cross-account querying for AWS Cloudwatch Plugin, see instructions [here](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/aws-cloudwatch/query-editor/#cross-account-observability).

## Authentication and authorization

### Map org-specific user roles from your OAuth provider

<!-- #identity-access, @Misi -->

_Generally available in Grafana Open Source and Enterprise_

Assign users to particular organizations with a specific role in Grafana, depending on an attribute value obtained from your identity provider.

This is a longstanding feature request from the community. We collaborated with our community to implement the request and have added this capability in Grafana 11.2.0.

For Generic OAuth and Okta, you can configure the claim (using the `org_attribute_path` setting) that contains the organizations which the user belongs to. Other OAuth providers use the same attribute for organization mapping that is used for group mapping: Entra ID (previously Azure AD), GitLab and Google use the current user’s Groups, and GitHub uses the user’s Teams.

To configure organization mapping for your instance, please check the documentation for the OAuth provider you are using in the [Grafana documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/). You can find an example of how to configure organization mapping on each OAuth provider page under the **Org roles mapping example** section.

### Better SAML integration for Azure AD

_Generally available in all editions of Grafana_

<!-- Lino Urdiales -->

When setting up Grafana with Azure AD using the SAML protocol, the Azure AD Graph API sometimes returns a follow-up Graph API call rather than the information itself. This is the case for users who belong to more than 150 groups when using SAML.

With Grafana 11.2, we offer a mechanism for setting up an application as a Service Account in Azure AD and retrieving information from Graph API.

Please refer to our documentation on how to set up an Azure AD registered application for this setup.

[Documentation](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/setup-grafana/configure-security/configure-authentication/saml/#configure-a-graph-api-application-in-azure-ad)

### API support for LDAP configuration

<!-- #proj-grafana-sso-config -->

_Available in public preview in all editions of Grafana_

[The SSO settings API](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/developers/http_api/sso-settings/) has been updated to include support for LDAP settings. This feature is experimental behind the feature flag **ssoSettingsLDAP**.

You will soon be able to configure LDAP from the UI and Terraform.
