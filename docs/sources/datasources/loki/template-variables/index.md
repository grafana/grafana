---
aliases:
  - ../../data-sources/loki/template-variables/
description: Guide for using template variables when querying the Loki data source
keywords:
  - grafana
  - loki
  - logs
  - queries
  - template
  - variable
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Template variables
title: Loki template variables
weight: 300
refs:
  add-template-variables-add-ad-hoc-filters:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters
  add-template-variables-global-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#global-variables
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#global-variables
  add-template-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
  variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/
  query-editor-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/query-editor/#options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/query-editor/#options
  configure-loki:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/loki/configure/
---

# Loki template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables. Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard. Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating](ref:variables) and [Add and manage variables](ref:add-template-variables) documentation.

## Before you begin

- Ensure you have [configured the Loki data source](ref:configure-loki).
- Your Loki instance should have logs with labels that you want to use as variable values.

## Use query variables

Use _Query_ type variables to dynamically fetch label names or label values from Loki. When you create a query variable with the Loki data source, you can choose what type of data to retrieve:

| Query type   | Example label | Example stream selector | List returned                                                    |
| ------------ | ------------- | ----------------------- | ---------------------------------------------------------------- |
| Label names  | Not required  | Not required            | Label names.                                                     |
| Label values | `label`       |                         | Label values for `label`.                                        |
| Label values | `label`       | `log stream selector`   | Label values for `label` in the specified `log stream selector`. |

### Create a query variable

To create a query variable for Loki:

1. Open the dashboard where you want to add the variable.
1. Click **Dashboard settings** (gear icon) in the top navigation.
1. Select **Variables** in the left menu.
1. Click **Add variable**.
1. Enter a **Name** for your variable (for example, `job`, `instance`, `level`).
1. In the **Type** dropdown, select **Query**.
1. In the **Data source** dropdown, select your Loki data source.
1. In the **Query type** dropdown, select **Label names** or **Label values**.
1. If you selected **Label values**, enter the label name in the **Label** field (for example, `job`).
1. Optionally, enter a **Stream selector** to filter the label values (for example, `{namespace="production"}`).
1. Click **Run query** to preview the variable values.
1. Configure display options such as **Multi-value** or **Include All option** as needed.
1. Click **Apply** to save the variable.

You can now use the variable in your Loki queries with the syntax `${variable_name}`. For example, `{job="$job"}` filters logs by the selected job.

## Use ad hoc filters

Loki supports the special **Ad hoc filters** variable type.
You can use this variable type to specify any number of key/value filters, and Grafana applies them automatically to all of your Loki queries.

For more information, refer to [Add ad hoc filters](ref:add-template-variables-add-ad-hoc-filters).

## Use the $\_\_auto variable for Loki metric queries

Consider using the `$__auto` variable in your Loki metric queries. This variable is automatically substituted with the [step value](ref:query-editor-options) for range queries, and with the selected time range's value (computed from the starting and ending times) for instant queries.

For more information about variables, refer to [Global built-in variables](ref:add-template-variables-global-variables).

## Extract and index labels in Loki

Labels play a fundamental role in Loki's log aggregation and querying capabilities. When logs are ingested into Loki, they are often accompanied by metadata called `labels`, which provide contextual information about the log entries. These labels consist of `key-value` pairs and are essential for organizing, filtering, and searching log data efficiently.

### Extract labels

During the ingestion process, Loki performs label extraction from log lines. Loki's approach to label extraction is based on `regular expressions`, allowing users to specify custom patterns for parsing log lines and extracting relevant label key-value pairs. This flexibility enables Loki to adapt to various log formats and schemas.

For example, suppose you have log lines in the following format:

```
2023-07-25 12:34:56 INFO: Request from IP A.B.C.D to endpoint /api/data
```

To extract labels from this log format, you could define a regular expression to extract the log level (`INFO`), IP address (`A.B.C.D`), and endpoint (`/api/data`) as labels. These labels can later be used to filter and aggregate log entries.

### Index labels

Once labels are extracted, Loki efficiently indexes them. The index serves as a lookup mechanism that maps labels to the corresponding log entries. This indexing process enables faster retrieval of logs based on specific label criteria, significantly enhancing query performance.

For instance, if you have a label "job" that represents different services in your application, Loki will index the logs for each job separately. This indexing allows you to quickly query and analyze logs for individual jobs without the need to scan the entire log dataset.

By effectively extracting and indexing labels, Loki enables users to perform complex and targeted log queries without compromising on query speed and resource consumption.

Combining Loki's indexed labels with Grafana template variables provides a powerful way to interactively explore and visualize log data. Template variables let you create dynamic queries that filter logs based on labels such as job names, instance IDs, or severity levels.
