+++
title = "Glossary"
description = "Grafana glossary"
keywords = ["grafana", "intro", "glossary", "dictionary"]
type = "docs"
aliases = ["/docs/grafana/latest/guides/glossary"]
[menu.docs]
name = "Glossary"
identifier = "glossary"
parent = "guides"
weight = 500
+++

# Glossary

This topic lists words and abbreviations that are commonly used in the Grafana documentation and community.

<table>
  <tr>
    <td style="vertical-align: top">Dashboard</td>
    <td>
      A set of one or more panels, organized and arranged into one or more rows, that provide an at-a-glance view of related information.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Data source</td>
    <td>
      A file, database, or service providing the data. Grafana supports a several data sources by default, and can be extended to support additional data sources through plugins.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Exemplar</td>
    <td>
      An exemplar is any data that serves as a detailed example of one of the observations aggregated into a metric. An exemplar contains the observed value together with an optional timestamp and arbitrary labels, which are typically used to reference a trace.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Graph</td>
    <td>
      A commonly-used visualization that displays data as points, lines, or bars.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Panel</td>
    <td>
      Basic building block in Grafana, composed by a query and a visualization. Can be moved and resized within a dashboard.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Plugin</td>
    <td>
      An extension of Grafana that allows users to provide additional functionality to enhance their experience. The types of plugins currently supported are:
      <ul>
        <li>
          <b>App plugin:</b> Extends Grafana with a customized experience. It includes a set of panel and data source plugins, as well as custom pages.
        </li>
        <li>
          <b>Data source plugin:</b> Extends Grafana with support for additional data sources.
        </li>
        <li>
          <b>Panel plugin:</b> Extends Grafana with additional visualization options.
        </li>
      </ul>
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Query</td>
    <td>
      Used to request data from a data source. The structure and format of the query depend on the specific data source.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Time series</td>
    <td>
      A series of measurements, ordered by time. Time series are stored in data sources and returned as the result of a query.
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Trace</td>
    <td>
      An observed execution path of a request through a distributed system. For more information, refer to [What is Distributed Tracing?](https://opentracing.io/docs/overview/what-is-tracing/).
    </td>
  </tr>
  <tr>
    <td style="vertical-align: top">Visualization</td>
    <td>A graphical representation of query results.</td>
  </tr>
</table>
