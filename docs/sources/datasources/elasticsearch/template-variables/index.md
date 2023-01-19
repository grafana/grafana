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
menuTitle: Template variables
title: Elasticsearch template variables
weight: 400
---

# Elasticsearch template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating]({{< relref "../../../dashboards/variables" >}}) and [Add and manage variables]({{< relref "../../../dashboards/variables/add-template-variables" >}}) documentation.

## Choose a variable syntax

The Elasticsearch data source supports two variable syntaxes for use in the **Query** field:

- `$varname`, such as `hostname:$hostname`, which is easy to read and write but doesn't let you use a variable in the middle of a word.
- `[[varname]]`, such as `hostname:[[hostname]]`

When the _Multi-value_ or _Include all value_ options are enabled, Grafana converts the labels from plain text to a Lucene-compatible condition.
For details, see the [Multi-value variables]({{< relref "../../../dashboards/variables/add-template-variables#multi-value-variables" >}}) documentation.

## Use variables in queries

You can use other variables inside the query.
This example is used to define a variable named `$host`:

```
{"find": "terms", "field": "hostname", "query": "source:$source"}
```

This uses another variable named `$source` inside the query definition.
Whenever you change the value of the `$source` variable via the dropdown, Grafana triggers an update of the `$host` variable to contain only hostnames filtered by, in this case, the `source` document property.

These queries by default return results in term order (which can then be sorted alphabetically or numerically as for any variable).
To produce a list of terms sorted by doc count (a top-N values list), add an `orderBy` property of "doc_count".
This automatically selects a descending sort.

> **Note:** To use an ascending sort (`asc`) with doc_count (a bottom-N list), set `order: "asc"`. However, Elasticsearch [discourages this](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html#search-aggregations-bucket-terms-aggregation-order) because sorting by ascending doc count can return inaccurate results.

To keep terms in the doc count order, set the variable's Sort dropdown to **Disabled**.
You can alternatively use other sorting criteria, such as **Alphabetical**, to re-sort them.

```
{"find": "terms", "field": "hostname", "orderBy": "doc_count"}
```

## Template variable examples

{{< figure src="/static/img/docs/elasticsearch/elastic-templating-query-7-4.png" max-width="500px" class="docs-image--no-shadow" caption="Query with template variables" >}}

In the above example, a Lucene query filters documents based on the `hostname` property using a variable named `$hostname`.
The example also uses a variable in the _Terms_ group by field input box, which you can use to quickly change how data is grouped.

To view an example dashboard on Grafana Play, see the [Elasticsearch Templated Dashboard](https://play.grafana.org/d/CknOEXDMk/elasticsearch-templated?orgId=1d).
