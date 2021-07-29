+++
title = "What's new in Grafana v8.1"
description = "Feature and improvement highlights for Grafana v8.1"
keywords = ["grafana", "new", "documentation", "8.1", "release notes"]
weight = -33
aliases = ["/docs/grafana/latest/guides/whats-new-in-v8-1/"]
[_build]
list = false
+++

# What’s new in Grafana v8.1

> **Note:** This topic will be updated frequently between now and the final release.

Grafana 8.1 builds upon our promise of composable, open observability platform with new panels and extends functionality launched in Grafana 8.0. We’ve got new panels, including the Geomap panel, the Annotations panel, and some great updates to the Time Series panel. For enterprise customers we’ve got additions to fine grained access control, updates to the reporting scheduler and more. We’ve also got some new transformations, updates to data sources and more. Details below.

We’ve summarized what’s new in the release here, but you might also be interested in the announcement blog post as well. If you’d like all the details you can checkout the complete [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).


## Grafana OSS features

These features are included in the Grafana open source edition.

## Geomap panel

Grafana 8.1 introduces the foundation for our new map panel. This new panel leverages [OpenLayers](https://openlayers.org/) and gives us a flexible solution for extending the way we use the new Geomap panel moving forward. The new Geomap panel includes multiple base layer styles (map layer options), as well as a more open data layer. The data layer can use coordinates and geo-hashed data in addition to a lookup table. 

The Geomap panel is also able to share views across multiple Geomap panels on the same dashboard, making it straightforward to visualize and explore multiple types of geospatial data using the same map zoom and focus settings. For more information, refer to [Geomap panel]({{< relref "../panels/visualizations/geomap.md" >}}) in our product documentation.

{{< figure src="/static/img/docs/geomap/geomap_heatmap.png" max-width="1200px" caption="Geomap panel: Heatmap" >}}

## Annotation panel

The new Annotations panel shows a list of available annotations you can use to create lists of annotated data available within your organization. Various options are available to filter the list based on tags and on the current dashboard. This panel makes it easy to find and filter annotated data within and across multiple dashboards.

{{< figure src="/static/img/docs/annolist/annolist.png" max-width="1200px" caption="Geomap panel: Heatmap" >}}

### Time series panel updates

Time series panels have been updated with the ability to color series and line by thresholds or gradient color scales. This allows users to create time series panels where the line color can change dynamically based on thresholds or using gradient color scales. his change adds a layer of visibility to your data, making it more straightforward to quickly see changes across thresholds at a glance.

Color scheme **From thresholds**: 
{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_line.png" max-width="1200px" caption="Colors scheme: From thresholds" >}}

Color scheme: **Green-Yellow-Red (by value)**
{{< figure src="/static/img/docs/time-series-panel/gradient_mode_scheme_thresholds_bars.png" max-width="1200px" caption="Color scheme: From thresholds" >}}

For more on how to configure Graphs with by value color schemes read [Graph and color schemes]({{< relref "../panels/visualizations/time-series/_index.md" >}}).

We've also added the ability to [create annotations on the new Time series panel]({{< relref "../panels/visualizations/time-series/annotate-time-series.md" >}}), bringing it closer to parity with the legacy Graph Panel. [Read more about the time series panel here]({{< relref "../panels/visualizations/time-series/_index.md" >}}). 

### Annotation panel

The new Annotations panel shows a list of available annotations you can use to create lists of annotated data available within your organization. Various options are available to filter the list based on tags and on the current dashboard. This panel makes it easy to find and filter annotated data within and across multiple dashboards.

{{< figure src="/static/img/docs/annolist/annolist.png" max-width="1200px" caption="Geomap panel: Heatmap" >}}

### Transformations improvements

Grafana 8.1 includes some significant enhancements to transformations, including two new transformations designed around providing dynamic configuration to your panels and visulizations.

#### Config from query (Beta)

This transformation enables panel config (Threshold, Min, Max, etc.) to be derived from query results. For more information, refer to [Config from query results transform]({{< relref "../panels/transformations/config-from-query.md" >}}).

#### Rows to fields (Beta)

This transformation enables rows in returned data to be converted into separate fields. Prior to this enhancement, you could style and configure fields individually, but not rows. For more information, refer to [Rows to fields transform]Added the ability annotations directly from the panel
You can now create annotations on the new Time series panel (introduced in Grafana 8)..

#### Contextual & Inline Help

Additional inline help will be available for Transformations. We can now share examples of how to use specific transformations and point users directly to the appropriate place in the docs for more information.

### Data source updates

The following data source updates are included with this Grafana release.

#### MySQL Data Source

We have added timezone support. As a result, you can now specify the time zone used in the database session, such as `Europe/Berlin` or `+02:00`.

### Trace to logs improvements

We have updated the default behavior from creating a one (1) hour span Loki query to only query at the exact time the trace span started for the duration of it. For more fine grained control over this you can shift this time in the tracing data source settings. It is now possible to to shift the start time and end time of the Loki query by the set amount. For more information, refer to [Trace to logs]({{< relref "../datasources/tempo.md#trace-to-logs" >}}).

#### Documentation updates

New panel summaries and preview on the top level [Visualizations]({{< relref "../panels/visualizations/_index.md" >}}) page to help users pick or learn about specific visualizations more easily.

## Enterprise features

These features are included in the Grafana Enterprise edition.

### Oauth2 - Team Sync to Group Mapping 

With Team Sync you can map your Generic OAuth groups to teams in Grafana so that the users are automatically added to the correct teams.

