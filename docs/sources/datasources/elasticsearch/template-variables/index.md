---
aliases:
  - ../../data-sources/elasticsearch/template-variables/
description: Using template variables with Elasticsearch in Grafana
keywords:
  - grafana
  - elasticsearch
  - templates
  - variables
  - queries
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: Elasticsearch template variables
weight: 400
refs:
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
  add-template-variables-add-ad-hoc-filters:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
  add-template-variables-multi-value-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#multi-value-variables
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#multi-value-variables
  add-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
---

# Elasticsearch template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in drop-down select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating](ref:variables) and [Add and manage variables](ref:add-template-variables) documentation.

## Use ad hoc filters

Elasticsearch supports the **Ad hoc filters** variable type.
You can use this variable type to specify any number of key/value filters, and Grafana applies them automatically to all of your Elasticsearch queries.

Ad hoc filters support the following operators:

| Operator | Description                                                   |
| -------- | ------------------------------------------------------------- |
| `=`      | Equals. Adds `AND field:"value"` to the query.                |
| `!=`     | Not equals. Adds `AND -field:"value"` to the query.           |
| `=~`     | Matches regex. Adds `AND field:/value/` to the query.         |
| `!~`     | Does not match regex. Adds `AND -field:/value/` to the query. |
| `>`      | Greater than. Adds `AND field:>value` to the query.           |
| `<`      | Less than. Adds `AND field:<value` to the query.              |

For more information, refer to [Add ad hoc filters](ref:add-template-variables-add-ad-hoc-filters).

## Choose a variable syntax

The Elasticsearch data source supports two variable syntaxes for use in the **Query** field:

- `$varname`, such as `hostname:$hostname`, which is easy to read and write but doesn't let you use a variable in the middle of a word.
- `[[varname]]`, such as `hostname:[[hostname]]`

When the _Multi-value_ or _Include all value_ options are enabled, Grafana converts the labels from plain text to a Lucene-compatible condition.
For details, refer to the [Multi-value variables](ref:add-template-variables-multi-value-variables) documentation.

## Use variables in queries

You can use variables in the Lucene query field, metric aggregation fields, bucket aggregation fields, and the alias field.

### Variables in Lucene queries

Use variables to filter your Elasticsearch queries dynamically:

```
hostname:$hostname AND level:$level
```

### Chain or nest variables

You can create nested variables, where one variable's values depend on another variable's selection.

This example defines a variable named `$host` that only shows hosts matching the selected `$environment`:

```json
{ "find": "terms", "field": "hostname", "query": "environment:$environment" }
```

Whenever you change the value of the `$environment` variable via the drop-down, Grafana triggers an update of the `$host` variable to contain only hostnames filtered by the selected environment.

### Variables in aggregations

You can use variables in bucket aggregation fields to dynamically change how data is grouped. For example, use a variable in the **Terms** group by field to let users switch between grouping by `hostname`, `service`, or `datacenter`.

## Template variable examples

{{< figure src="/static/img/docs/elasticsearch/elastic-templating-query-7-4.png" max-width="500px" class="docs-image--no-shadow" caption="Query with template variables" >}}

In the above example, a Lucene query filters documents based on the `hostname` property using a variable named `$hostname`.
The example also uses a variable in the _Terms_ group by field input box, which you can use to quickly change how data is grouped.

## Create a query

Write the query using a custom JSON string, with the field mapped as a [keyword](https://www.elastic.co/guide/en/elasticsearch/reference/current/keyword.html#keyword) in the Elasticsearch index mapping.

If the query is [multi-field](https://www.elastic.co/guide/en/elasticsearch/reference/current/multi-fields.html) with both a `text` and `keyword` type, use `"field":"fieldname.keyword"` (sometimes `fieldname.raw`) to specify the keyword field in your query.

| Query                                                                          | Description                                                                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `{"find": "fields", "type": "keyword"}`                                        | Returns a list of field names with the index type `keyword`.                                           |
| `{"find": "fields", "type": "number"}`                                         | Returns a list of numeric field names (includes `float`, `double`, `integer`, `long`, `scaled_float`). |
| `{"find": "fields", "type": "date"}`                                           | Returns a list of date field names.                                                                    |
| `{"find": "terms", "field": "hostname.keyword", "size": 1000}`                 | Returns a list of values for a keyword field. Uses the current dashboard time range.                   |
| `{"find": "terms", "field": "hostname", "query": "<Lucene query>"}`            | Returns a list of values filtered by a Lucene query. Uses the current dashboard time range.            |
| `{"find": "terms", "field": "status", "orderBy": "doc_count"}`                 | Returns values sorted by document count (descending by default).                                       |
| `{"find": "terms", "field": "status", "orderBy": "doc_count", "order": "asc"}` | Returns values sorted by document count in ascending order.                                            |

Queries of `terms` have a 500-result limit by default. To set a custom limit, set the `size` property in your query.

### Sort query results

By default, queries return results in term order (which can then be sorted alphabetically or numerically using the variable's Sort setting).

To produce a list of terms sorted by document count (a top-N values list), add an `orderBy` property of `doc_count`. This automatically selects a descending sort:

```json
{ "find": "terms", "field": "status", "orderBy": "doc_count" }
```

You can also use the `order` property to explicitly set ascending or descending sort:

```json
{ "find": "terms", "field": "hostname", "orderBy": "doc_count", "order": "asc" }
```

{{< admonition type="note" >}}
Elasticsearch [discourages](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html#search-aggregations-bucket-terms-aggregation-order) sorting by ascending doc count because it can return inaccurate results.
{{< /admonition >}}

To keep terms in the document count order, set the variable's Sort drop-down to **Disabled**. You can alternatively use other sorting criteria, such as **Alphabetical**, to re-sort them.
