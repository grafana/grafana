---
_build:
  list: false
aliases:
  - ../guides/whats-new-in-v7-3/
description: Feature and improvement highlights for Grafana v7.3
keywords:
  - grafana
  - new
  - documentation
  - '7.3'
  - release notes
title: What's New in Grafana v7.3
weight: -30
---

# What's new in Grafana v7.3

This topic includes the release notes for Grafana v7.3. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) or the [Patch release notes](#patch-release-notes).

The main highlights are:

- [**Google Cloud Monitoring:** Out of the box dashboards]({{< relref "#cloud-monitoring-out-of-the-box-dashboards" >}})
- [**Shorten URL for dashboards and Explore**]({{< relref "#shorten-url-for-dashboards-and-explore" >}})
- [**Table improvements and new image cell mode**]({{< relref "#table-improvements-and-new-image-cell-mode" >}})
- [**New color scheme option**]({{< relref "#new-color-scheme-option" >}})
- [**SigV4 Authentication for Amazon Elasticsearch Service**]({{< relref "#sigv4-authentication-for-aws-users" >}})
- [**CSV exports for Excel**]({{< relref "#csv-exports-for-excel" >}})

## Table improvements and new image cell mode

The table has been updated with improved hover behavior for cells that have longer content than what fits the current column width. As you can see
in the animated gif below the cell will automatically expand to show you full content of the cell.

{{< figure src="/static/img/docs/v73/table_hover.gif" max-width="900px" caption="Table hover" >}}

Another new feature that can be seen in the image above is the new image cell display mode. If you have a field value that is an image URL or a base64 encoded image you can configure the table to display it as an image.

## New color scheme option

{{< figure src="/static/img/docs/v73/color_scheme_dropdown.png" max-width="450px" caption="Color scheme" class="pull-right" >}}

A new standard field color scheme option has been added. This new option will provide a unified way for all new panels to specify how colors should be assigned. For more information, refer to [Apply color to series and fields](../panels/working-with-panels/apply-color-to-series.md)

- **Single color**: Specifies a single color. Useful in an override rule.
- **From thresholds**: Informs Grafana to take color from the matching threshold.
- **Classic palette**: Assigns a color by looking up a color in a palette by series index. Useful for Graphs and pie charts, and other categorical data visualizations in Grafana.
- **Green-Yellow-Red (by value)**: A continuous color scheme where Grafana will interpolate a color based on the value assigned to the green, yellow, and red components. The value must be within the min & max limits.
- **Blue-Yellow-Red (by value)**: Same as above but different colors.
- **Blues (by value)**: Same as above but color scheme go from panel background to blue.

<div class="clearfix"></div>

As you can see this adds new continuous color schemes where Grafana will interpolate colors. A great use of these new color schemes is the table panel where you can color the background and get a heatmap like effect.

{{< figure src="/static/img/docs/v73/table_color_scheme.png" max-width="900px" caption="table color scheme" >}}

Another thing to highlight is that all these new color schemes are theme aware and adapt to the current theme. For example here is how the new monochrome color scheme look like in the light theme:

{{< figure src="/static/img/docs/v73/table_color_scheme_mono_light.png" max-width="900px" caption="table color monochrome scheme" >}}

As this new option is a standard field option it works in every panel. Here is another example from the [Bar Gauge]({{< relref "../visualizations/bar-gauge-panel.md" >}}) panel.

{{< figure src="/static/img/docs/v73/bar_gauge_gradient_color_scheme.png" max-width="900px" caption="bar gauge color scheme" >}}

## CSV exports for Excel

In v7.0, we introduced a new table panel and inspect mode with Download CSV enabled. However, CSV export to Excel was removed. Due to a large number of inquiries and requests, this [community contribution from tomdaly](https://github.com/grafana/grafana/pull/27284) brought the feature back.

For more information, refer to [Download raw query results]({{< relref "../panels/query-a-data-source/download-raw-query-results.md" >}}).

## Google Cloud monitoring out-of-the-box dashboards

The updated Google Cloud monitoring data source is shipped with pre-configured dashboards for five of the most popular Google Cloud Platform (GCP) services:

- BigQuery
- Cloud Load Balancing
- Cloud SQL
- Google Compute Engine `GCE`
- Google Kubernetes Engine `GKE`

To import the pre-configured dashboards, go to the configuration page of your Google Cloud Monitoring data source and click on the `Dashboards` tab. Click `Import` for the dashboard you would like to use. To customize the dashboard, we recommend to save the dashboard under a different name, because otherwise the dashboard will be overwritten when a new version of the dashboard is released.

For more details, see the [Google Cloud Monitoring docs]({{<relref "../datasources/google-cloud-monitoring/_index.md/#out-of-the-box-dashboards">}})

## Shorten URL for dashboards and Explore

This is an amazing new feature that was created in cooperation with one of our community members. The new share shortened link capability allows you to create smaller and simpler URLs of the format `/goto/:uid` instead of using longer URLs that can contain complex query parameters. In Explore, you can create a shortened link by clicking on the share button in Explore toolbar. In the dashboards, a shortened url option is available through the share panel or dashboard button.

## SigV4 authentication for AWS users

You can now configure your Elasticsearch data source to access your Amazon Elasticsearch Service domain directly from Grafana.

For more details, refer to the [Elasticsearch docs]({{<relref "../datasources/elasticsearch/#aws-signature-version-4-authentication">}}).

## Chaining pipeline aggregation in Elasticsearch

Thanks to a contribution from a community member, it's now possible to chain multiple pipeline aggregations together and use the results of one pipeline aggregation as the input of another. This unleashes the full power of Elasticsearch's pipeline aggregations in Grafana, allowing users to perform high order derivatives or use a pipeline aggregation result as a variable for a Bucket Script Aggregation.

## Grafana Enterprise features

These features are included in the Grafana Enterprise edition software.

### Auditing

Auditing tracks important changes to your Grafana instance to help you manage and mitigate suspicious activity and meet compliance requirements. Grafana logs events (as JSON) to file or directly to [loki](/oss/loki/).

Example of a login event:

```json
{
  "timestamp": "2020-10-22T10:18:00.838094347Z",
  "user": {
    "userId": 1,
    "orgId": 1,
    "isAnonymous": false
  },
  "action": "login-grafana",
  "result": {
    "statusType": "success",
    "statusCode": 200
  },
  "requestUri": "/login",
  "ipAddress": "127.0.0.1:41324",
  "userAgent": "Chrome/86.0.4240.111",
  "grafanaVersion": "7.3.0"
}
```

For more details, see the [Auditing docs]({{<relref "../enterprise/auditing.md">}}).

### Data source usage insights

Data source usage insights allows you to gain insight into how a data source is being used and how well it works. There is a new tab in the data source settings page called insights that will show you information about how the data source has been used in the past 30 days.

Insights:

- Queries per day
- Errors per day
- Average load duration per day (ms)

### SAML single logout

SAML’s single logout (SLO) capability allows users to log out from all applications associated with the current identity provider (IdP) session established via SAML SSO. For more information, refer to the [docs]({{<relref "../enterprise/saml/#single-logout">}}).

### SAML IdP-initiated single sign on

IdP-initiated single sign on (SSO) allows the user to log in directly from the SAML identity provider (IdP). It is disabled by default for security reasons. For more information, refer to the [docs]({{<relref "../enterprise/saml/#idp-initiated-single-sign-on-sso">}}).

## Upgrading

See [upgrade notes]({{< relref "../installation/upgrading.md" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.

## Patch release notes

- [Grafana 7.3.0 release notes]({{< relref "../release-notes/release-notes-7-3-0.md" >}})
- [Grafana 7.3.1 release notes]({{< relref "../release-notes/release-notes-7-3-1.md" >}})
- [Grafana 7.3.2 release notes]({{< relref "../release-notes/release-notes-7-3-2.md" >}})
- [Grafana 7.3.3 release notes]({{< relref "../release-notes/release-notes-7-3-3.md" >}})
- [Grafana 7.3.4 release notes]({{< relref "../release-notes/release-notes-7-3-4.md" >}})
- [Grafana 7.3.5 release notes]({{< relref "../release-notes/release-notes-7-3-5.md" >}})
- [Grafana 7.3.6 release notes]({{< relref "../release-notes/release-notes-7-3-6.md" >}})
- [Grafana 7.3.7 release notes]({{< relref "../release-notes/release-notes-7-3-7.md" >}})
