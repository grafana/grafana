+++
title = "Variables types"
type = "docs"
[menu.docs]
weight = 300
+++

# Variables types

Grafana uses several types of variables.

|  Variable type  | Description   |
|:---|:---|
| Query   | Query-generated list of values such as metric names, server names, sensor IDs, data centers, and so on. [Add a query variable]({{< relref "add-query-variable.md" >}}).   |
| Custom   | Define the variable options manually using a comma-separated list. [Add a custom variable]({{< relref "add-custom-variable.md" >}}).   |
| Text box   | Display a free text input field with an optional default value. [Add a text box variable]({{< relref "add-text-box-variable.md" >}}).   |
| Constant   | Define a hidden constant. [Add a constant variable]({{< relref "add-constant-variable.md" >}}).   |
| Data source   | Quickly change the data source for an entire dashboard. [Add a data source variable]({{< relref "add-data-source-variable.md" >}}).   |
| Interval   | Interval variables represent time spans. [Add an interval variable]({{< relref "add-interval-variable.md" >}}).   |
| Ad hoc filters   | Key/value filters that are automatically added to all metric queries for a data source (InfluxDB, Prometheus, and Elasticsearch only). [Add ad hoc filters]({{< relref "add-ad-hoc-filters.md" >}}).   |
| Global variables   | Built-in variables that can be used in expressions in the query editor. Refer to [Global variables]({{< relref "global-variables" >}}).   |
| Chained variables   | Variable queries can contain other variables. Refer to [Chained variables]({{< relref "chained-variables.md" >}}).   |