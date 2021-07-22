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

This topic includes the release notes for Grafana v8.1. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

## Grafana OSS features

These features are included in the Grafana open source edition.

### Time series panel updates

Time series panels have been updated with the ability to color series and line by thresholds or gradient color scales. This allows users to create time series panels where the line color can change dynamically based on thresholds or using gradient color scales. 

Also, we have added possibility to create annotations directly from the panel. For more information, refer to ...


### Geomap panel

Grafana 8.1 introduces the foundation for our new map panel. This new panel leverages [OpenLayers](https://openlayers.org/) and gives us a flexible solution for extending the way we use the new Geomap panel moving forward. We expect to ship this new visualization with the ability to use [Circle Overlays](https://github.com/grafana/grafana/pull/36680) and [Heatmaps](https://github.com/open-o11y/grafana/pull/18).

For more information, refer to [issue 36585](https://github.com/grafana/grafana/issues/36585). For documentation, refer to ...

### Annotation panel

This section is for the new panel...

### Transformations improvements

Grafana 8.1 includes many transformations enhancements.

#### Config from query (Beta)

This transformation enables panel config (Threshold, Min, Max, etc.) to be derived from query results. For more information, refer to [Config from query results transform]({{< relref "../panels/transformations/config-from-query.md" >}}).

#### Rows to fields (Beta)

This transformation enables rows in returned data to be converted into separate fields. Prior to this enhancement, you could style and configure fields individually, but not rows. For more information, refer to [Rows to fields transform]({{< relref "../panels/transformations/rows-to-fields.md" >}}).


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

