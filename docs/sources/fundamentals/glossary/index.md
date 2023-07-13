---
aliases:
  - ../basics/glossary/
  - ../getting-started/glossary/
  - ../guides/glossary/
description: Grafana glossary
keywords:
  - grafana
  - intro
  - glossary
  - dictionary
title: Glossary
weight: 850
---

# Glossary

This topic lists words and abbreviations that are commonly used in the Grafana documentation and community.

<table>
  <tr>
    <td style="vertical-align: top">app plugin</td>
    <td>
      An extension of Grafana that allows users to provide additional functionality to enhance their experience by including a set of panel and data source plugins, as well as custom pages. See also <i>data source plugin</i>, <i>panel plugin</i>, and <i>plugin</i>.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">dashboard</td>
    <td>
      A set of one or more panels, organized and arranged into one or more rows, that provide an at-a-glance view of related information.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">data source</td>
    <td>
      A file, database, or service providing the data. Grafana supports several data sources by default, and can be extended to support additional data sources through plugins.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">data source plugin</td>
    <td>
      Extends Grafana with support for additional data sources. See also <i>data source</i>, <i>app plugin</i>, <i>panel plugin</i>, and <i>plugin</i>.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">exemplar</td>
    <td>
      An exemplar is any data that serves as a detailed example of one of the observations aggregated into a metric. An exemplar contains the observed value together with an optional timestamp and arbitrary labels, which are typically used to reference a trace.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Explore</td>
    <td>
      Explore allows a user to focus on building a query. Users can refine the query to return the expected metrics before building a dashboard. For more information, refer to the <a href="https://grafana.com/docs/grafana/latest/explore">Explore</a> topic.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">export or import dashboard</td>
    <td>
      Grafana includes the ability to export your dashboards to a file containing JSON. Community members sometimes share their created dashboards on the <a href="https://grafana.com/grafana/dashboards">Grafana Dashboards page</a>. Dashboards previously exported or found on this site may be imported by other users.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">exporter</td>
    <td>
      An exporter translates data that comes out of a data source into a format that Prometheus can digest.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Integration (Grafana Cloud)</td>
    <td>
      Each Integration in Grafana Cloud uses the cloud agent to connect your data source to Grafana Cloud for visualizing. Note: Prometheus uses the word “integrations” to refer to software that exposes Prometheus metrics without needing an exporter, which is a different use of the same word we use here.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">graph</td>
    <td>
      A commonly-used visualization that displays data as points, lines, or bars.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">mixin</td>
    <td>
      A mixin is a set of Grafana dashboards and Prometheus rules and alerts, written in Jsonnet and packaged together in a bundle.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">panel</td>
    <td>
      Basic building block in Grafana, composed by a query and a visualization. Can be moved and resized within a dashboard.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">panel plugin</td>
    <td>
      Extends Grafana with additional visualization options. See also <i>panel</i>, <i>plugin</i>, <i>app plugin</i>, and <i>data source plugin</i>.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">plugin</td>
    <td>
      An extension of Grafana that allows users to provide additional functionality to enhance their experience. See also <i>app plugin</i>, <i>data source plugin</i>, and <i>panel plugin</i>.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">query</td>
    <td>
      Used to request data from a data source. The structure and format of the query depend on the specific data source.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">time series</td>
    <td>
      A series of measurements, ordered by time. Time series are stored in data sources and returned as the result of a query.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">trace</td>
    <td>
      An observed execution path of a request through a distributed system. For more information, refer to <a href="https://opentracing.io/docs/overview/what-is-tracing/">What is Distributed Tracing?</a>
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">transformation</td>
    <td>
      Transformations process the result set of a query before it’s passed on for visualization. For more information, refer to the <a href="https://grafana.com/docs/grafana/latest/panels/transformations">Transformations overview</a> topic.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">visualization</td>
    <td>A graphical representation of query results.</td>
  </tr>
</table>
