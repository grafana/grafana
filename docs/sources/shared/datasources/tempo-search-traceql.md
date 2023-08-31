---
headless: true
labels:
  products:
    - enterprise
    - oss
---

[//]: # 'This file documents the Search query type for the Tempo data source.'
[//]: # 'This shared file is included in these locations:'
[//]: # '/grafana/docs/sources/datasources/tempo/query-editor/index.md'
[//]: # '/website/docs/grafana-cloud/data-configuration/traces/traces-query-editor.md'
[//]: # '/tempo/docs/sources/tempo/traceql/query_editor.md'
[//]: #
[//]: # 'If you make changes to this file, verify that the meaning and content are not changed in any place where the file is included.'
[//]: # 'Any links should be fully qualified and not relative: /docs/grafana/ instead of ../grafana/.'

# Write TraceQL queries using Search

The TraceQL query builder, located on the **Explore** > **Query type** > **Search** in Grafana, provides drop-downs and text fields to help you write a query.

![The TraceQL query builder](/static/img/docs/tempo/screenshot-traceql-query-type-search-v10.png)

The builder lets you run the most common queries in as few clicks as possible. You don't need to know the underlying query language or database architecture to use it.

The builder supports a subset of TraceQL capabilities. For example, if you wish to use structural operators (`>>`, `>`, `~`), you need to use the query editor on the **TraceQL** tab.

You can use the query builder’s drop-downs to compose TraceQL queries. The selections you make automatically generate a [TraceQL query](/docs/tempo/latest/traceql).

To access **Search**, select your Tempo data source, and then choose **Explore** and select **Query type** > **Search**.
You can use the query builder to search trace data by resource service name, span name, duration, and one or more tags. The examples on this page use the default filters.

In addition, you can add query builder blocks, view the query history, and use the **Inspector** to see details.

{{< figure src="/static/img/docs/queries/screenshot-tempods-query-search.png" class="docs-image--no-shadow" max-width="750px" caption="Screenshot of the Tempo Search query type" >}}

## Perform a search

To perform a search, you need to select filters and/or tags and then run the query. The results appear underneath the query builder.
The screenshot below identifies the areas used to perform a search.

{{< figure src="/static/img/docs/queries/screenshot-tempods-query-search-parts.png" class="docs-image--no-shadow" max-width="750px" caption="Parts of Tempo Search query type" >}}

| Number | Name               | Action                                                                                                                                                                     | Comment                                                                                                                                          |
| :----- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Data source        | Use the data source drop-down to select a Tempo data source.                                                                                                               | Each data source has its own version of search. This Search is specific to the Tempo data source.                                                |
| 2      | Query type tab     | Select Search.                                                                                                                                                             |                                                                                                                                                  |
| 3      | Choose filter      | Choose whether to filter using **Resource Service Name**, **Span Name**, and/or **Duration**.                                                                              | Optional. You can execute an empty query in the Search tab. In TraceQL, `{}` is a valid query and is the default query until you choose options. |
| 4      | Filters conditions | Select options for one or more filters. For example, you can define a filter where **Resource Service Name** (`resource.service.name`) equals (`=`) `cloud-logs-archiver`. | Optional. At least one tag or filter must be defined.                                                                                            |
| 5      | Tags               | Add tags for span, resource, or unscoped and define their conditions.                                                                                                      | Optional.                                                                                                                                        |
| 6      | TraceQL query      | Displays the TraceQL query constructed by your selections.                                                                                                                 | This TraceQL query is executed when you select **Run query**.                                                                                    |

Every query searches the data for the selected time frame.
By default, queries run against data from the last hour.
Select Time range to the left of Run query to choose the time range for the data your query runs against.
Read the [dashboard time range](/docs/grafana/latest/dashboards/use-dashboards/#set-dashboard-time-range) documentation to learn more.

To access Search, use the following steps:

1. Sign into Grafana.
1. Select your Tempo data source.
1. From the menu, choose Explore and select Query type > Search.

## Define filters

Using filters, you refine the data returned from the query by selecting Resource Service Name, Span Name, or Duration. The **Duration** represents span time, calculated by subtracting the end time from the start time of the span.

Grafana administrators can change the default filters using the Tempo data source configuration.
Filters can be limited by the operators. The available operators are determined by the field type.
For example, **Span Name** and **Resource Service Name** are string fields so the comparison operators are equals (`=`), not equal (`!=`), or regular expressions (`=~`).
**Duration** is a duration field type and uses range selections (`>`, `>=`, `<`, `<=`).

When you select multiple values for the same filter, Grafana automatically changes the operator to the regex operator `=~` and concatenates the values with a `|`. This capability only applies to fields with drop-down value selection.

For example, if you choose **Span Name** `= get` and then **Span Name** `= log_results_cache,` operator drop-down changes from `=` to `=~` and both `get` and `log_results_cache` are listed in the **Span Name** field. The resulting query is updated with this:

`{duration>5ms && duration<10ms && name=~"get|log_results_cache"}`

To define filters, follow these steps:

1. Choose one of the filters.
1. Select a comparison operator from the drop-down.
1. **Resource Service Name** and **Span Name** only: Select one or more values from the drop-down.
1. **Duration** only: Enter values and units for the range and choose comparison operators for the drop-downs. Units can be nanoseconds (`ns`), milliseconds (`ms`), seconds (`s`), minutes (`m`), and hours (`h`).

You can either select **Run query** to execute the query or define tags and then run the query.

## Define tags

You can add any tags to your query. Tags can be selected by scoped (span or resource) or unscoped. If you select unscoped, then all tags are searched for matches.

To add a tag, follow these steps:

1. Select span, resource, or unscoped.
1. Select a tag from the **Select tag** drop-down.
1. Select a comparison operator.
1. Select a value from the **Select value** drop-down. This field is populated based upon the tag.
1. Optional: Select **+** to add an additional tag.

### Optional: Use Aggregate by

{{% admonition type="warning" %}}
**Aggregate by** is an [experimental feature](/docs/release-life-cycle/). Engineering and on-call support is not available. Documentation is either limited or not provided outside of code comments. No SLA is provided.
[Enable the `metricsSummary` feature toggle](/docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/) in Grafana to use this feature. Contact Grafana Support to enable this feature in Grafana Cloud.
{{% /admonition %}}

Using **Aggregate by**, you can group RED metrics (span count, erroring span count, and latency information) for `kind=server` spans sent to Tempo in the last hour, grouped by a user-specified attribute.
For example, you can group request rate and latency metrics by attribute for spans of `kind=server`.

This capability is based on the [metrics summary API](/docs/grafana-cloud/monitor-infrastructure/traces/metrics-summary-api/).

To use this capability:

1. In the Attribute by row, select an option from the first drop-down box. For example, `span`.
1. Select an attribute from the second drop-down.
1. Optional: Select **+** to add an **Aggregate by** row.
1. Select **Run query**.

### Optional: Add queries

Using **Add query**, you can have successive queries that run in sequential order.
For example, query A runs and then query B.
You can reorder the queries by dragging and dropping them above or below other queries.
Select **+ Add query** to add another query block.

### Run queries and view results

Select **Run query** to run the TraceQL query (1 in the screenshot).

Queries can take a little while to return results. The results appear in a table underneath the query builder. Selecting a Trace ID (2 in the screenshot) displays more detailed information (3 in the screenshot).

{{< figure src="/static/img/docs/queries/screenshot-tempods-query-results.png" class="docs-image--no-shadow" max-width="750px" caption="Tempo Search query type results" >}}
