+++
title = "What's New in Grafana v7.3"
description = "Feature and improvement highlights for Grafana v7.3"
keywords = ["grafana", "new", "documentation", "7.3", "release notes"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/whats-new-in-v7-3/"]
[menu.docs]
name = "Version 7.3"
identifier = "v7.3"
parent = "whatsnew"
weight = -17
+++

# What's new in Grafana v7.3

This topic includes the release notes for the Grafana v7.3. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

The main highlights are:

- [**Google Cloud Monitoring:** Out of the box dashboards]({{< relref "#cloud-monitoring-out-of-the-box-dashboards" >}})
- [**Shorten URL for dashboards and Explore**]({{< relref "#shorten-url-for-dashboards-and-explore" >}})
- [**Table improvements and new image cell mode**]({{< relref "#table-improvements-and-new-image-cell-mode" >}})
- [**New color scheme option**]({{< relref "#new-color-scheme-option" >}})
- [**SigV4 Authentication for Amazon Elasticsearch Service**]({{< relref "#sigv4-authentication-for-aws-users" >}})

## Table improvements and new image cell mode

The table has been updated with improved hover behavior for cells that have longer content than what fits the current column width. As you can see
in the animated gif below the cell will automatically expand to show you full content of the cell.

{{< figure src="/img/docs/v73/table_hover.gif" max-width="900px" caption="Table hover" >}}

Another new feature that can be seen in the image above is the new image cell display mode. If you have a field value that is an image URL or a base64 encoded image you can configure the table to display it as an image.

## New color scheme option

{{< figure src="/img/docs/v73/color_scheme_dropdown.png" max-width="450px" caption="Color scheme" class="pull-right" >}}

A new standard field [color scheme]({{< relref "../panels/field-options/standard-field-options.md#color-scheme" >}}) option has been added. This new option will provide a unified way for all new panels to specify how colors should be assigned. 

* **Single color**: Specify a single color, useful in an override rule. 
* **From thresholds**: Informs Grafana to take the color from the matching threshold. 
* **Classic palette**: Grafana will assign color by looking up a color in a palette by series index. Useful for Graphs and pie charts and other categorical data visualizations. 
* **Green-Yellow-Red (by value)**: This is a continuous color scheme where Grafana will interpolate a color based on the value being displayed and the field  min & max values.  
* **Blue-Yellow-Red (by value)**: Same as above but different colors.
* **Blues (by value)**: Same as above but color scheme go from panel background to blue. 

<div class="clearfix"></div>

As you can see this adds new continuous color schemes where Grafana will interpolate colors. A great use of these new color schemes is the table panel where you can color the background and get a heatmap like effect. 

{{< figure src="/img/docs/v73/table_color_scheme.png" max-width="900px" caption="table color scheme" >}}

Another thing to highlight is that all these new color schemes are theme aware and adapt to the current theme. For example here is how the new monochrome color scheme look like in the light theme: 

{{< figure src="/img/docs/v73/table_color_scheme_mono_light.png" max-width="900px" caption="table color monochrome scheme" >}}

As this new option is a standard field option it works in every panel. Here is another example from the [Bar Gauge]({{< relref "../panels/visualizations/bar-gauge-panel.md" >}}) panel. 

{{< figure src="/img/docs/v73/bar_gauge_gradient_color_scheme.png" max-width="900px" caption="bar gauge color scheme" >}}

## Google Cloud monitoring out-of-the-box dashboards

The updated Google Cloud monitoring data source is shipped with pre-configured dashboards for five of the most popular Google Cloud Platform (GCP) services:

- BigQuery
- Cloud Load Balancing
- Cloud SQL
- Google Compute Engine `GCE`
- Google Kubernetes Engine `GKE`

To import the pre-configured dashboards, go to the configuration page of your Google Cloud Monitoring data source and click on the `Dashboards` tab. Click `Import` for the dashboard you would like to use. To customize the dashboard, we recommend to save the dashboard under a different name, because otherwise the dashboard will be overwritten when a new version of the dashboard is released.

For more details, see the [Google Cloud Monitoring docs]({{<relref "../datasources/cloudmonitoring/#out-of-the-box-dashboards">}})

## Shorten URL for dashboards and Explore

This is an amazing new feature that was created in cooperation with one of our community members. The new share shortened link capability allows you to create smaller and simpler URLs of the format `/goto/:uid` instead of using longer URLs that can contain complex query parameters. In Explore, you can create a shortened link by clicking on the share button in Explore toolbar. In the dashboards, a shortened url option is available through the share panel or dashboard button.

## SigV4 authentication for AWS users

You can now configure your Elasticsearch data source to access your Amazon Elasticsearch Service domain directly from Grafana.

For more details, refer to the [Elasticsearch docs]({{<relref "../datasources/elasticsearch/#aws-signature-version-4-authentication">}}).

## Grafana Enterprise features

These features are included in the Grafana Enterprise edition software.

### Auditing

### Datasource Usage Insights

### SAML Improvements

## Upgrading

See [upgrade notes]({{< relref "../installation/upgrading.md" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.
