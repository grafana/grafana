+++
title = "What's New in Grafana v7.4"
description = "Feature and improvement highlights for Grafana v7.3"
keywords = ["grafana", "new", "documentation", "7.3", "release notes"]
aliases = ["/docs/grafana/latest/guides/whats-new-in-v7-3/"]
weight = -30
[_build]
list = false
+++

# What's new in Grafana v7.4

This topic includes the release notes for Grafana v7.4 beta. For all details, read the full [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md).

The main highlights are:

- [Grafana OSS featuresff](#grafana-oss-featuresff)
- [Grafana Enterprise features](#grafana-enterprise-features)

## Grafana OSS features

These features are included in the Grafana Enterprise edition software.

### Beta Time series panel visualization

Grafana 7.4 brings the beta version of the next-gen graph visualization. The new graph panel, the _Time series_ visualization, is high-performance visualization based on the uPlot library. This new graph visualization uses the new panel architecture introduced in Grafana 7.0 and integrates with field options, overrides, and transformations.

The Time series beta panel implements the majority of the functionalities available in the current Graph panel. Our plan is to have close to full coverage of the features in Grafana 8.0, coming later this year.

Apart from major performance improvements, the new Time series panel implements new features like line interpolation modes, support for more than two Y-axes, soft min and max axis limits, automatic points display based on data density, and gradient fill modes.

### Beta Node graph panel visualization

_Node graph_ is a new panel type that can visualize directed graphs or network in dashboards, but also in Explore. It uses directed force layout to effectively position the nodes so it can help with displaying complex infrastructure maps, hierarchies, or execution diagrams.

All the information and stats shown in the Node graph beta are driven by the data provided in the response from the data source. The first data source that is using this panel is AWS X-Ray, for displaying their service map data.

For more details about how to use the X-Ray service map feature, see the [X-Ray plugin documentation](https://grafana.com/grafana/plugins/grafana-x-ray-datasource).

### New transformations

The following transformations were added in Grafana 7.4.

#### Sort by transformation

The _Sort by_ transformation allows you to sort data before sending it to the visualization.

For more information, refer to [Filter data by value]({{< relref "../panels/transformations/types-options.md#sort-by" >}}) in [Transformation types and options]({{< relref "../panels/transformations/types-options.md" >}}).

#### Filter data by value transform

The new _Filter data by value_ transformation allows you to filter your data directly in Grafana and remove some data points from your query result.

This transformation is very useful if your data source does not natively filter by values. You might also use this to narrow values to display if you are using a shared query.

For more information, refer to [Filter data by value]({{< relref "../panels/transformations/types-options.md#filter-data-by-value" >}}) in [Transformation types and options]({{< relref "../panels/transformations/types-options.md" >}}).

### Exemplar support

Grafana graphs now support Prometheus exemplars. They are displayed as diamonds in the graph visualization.

> **Note:** Support for exemplars will be added in version Prometheus 2.25+,

![Exemplar example](/img/docs/v74/exemplars.png)

## Grafana Enterprise features

These features are included in the Grafana Enterprise edition software.



## Upgrading

See [upgrade notes]({{< relref "../installation/upgrading.md" >}}).

## Changelog

Check out [CHANGELOG.md](https://github.com/grafana/grafana/blob/master/CHANGELOG.md) for a complete list of new features, changes, and bug fixes.

