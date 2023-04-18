---
aliases:
  - /docs/sources/panels/query-a-data-source/manage-queries/
title: Manage queries
weight: 50
---

# Manage queries

Queries are organized in collapsible query rows. Each query row contains a query editor and is identified with a letter (A, B, C, and so on).

You can:

|                                                                    Icon                                                                     | Description                                                                                                                                                                                                                                    |
| :-----------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  {{< figure src="/static/img/docs/queries/query-editor-help-7-4.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}}   | Toggle query editor help. If supported by the data source, click this icon to display information on how to use the query editor or provide quick access to common queries.                                                                    |
| {{< figure src="/static/img/docs/queries/duplicate-query-icon-7-0.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}} | Copy a query. Duplicating queries is useful when working with multiple complex queries that are similar and you want to either experiment with different variants or do minor alterations.                                                     |
|   {{< figure src="/static/img/docs/queries/hide-query-icon-7-0.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}}    | Hide a query. Grafana does not send hidden queries to the data source.                                                                                                                                                                         |
|  {{< figure src="/static/img/docs/queries/remove-query-icon-7-0.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}}   | Remove a query. Removing a query permanently deletes it, but sometimes you can recover deleted queries by reverting to previously saved versions of the panel.                                                                                 |
|   {{< figure src="/static/img/docs/queries/query-drag-icon-7-2.png" class="docs-image--no-shadow" max-width="30px" max-height="30px" >}}    | Reorder queries. Change the order of queries by clicking and holding the drag icon, then drag queries where desired. The order of results reflects the order of the queries, so you can often adjust your visual results based on query order. |
