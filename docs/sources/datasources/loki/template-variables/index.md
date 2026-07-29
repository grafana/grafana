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
review_date: 2026-07-29
---

# Loki template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/) and [Add and manage variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/) documentation.

## Use query variables

Variables of the type _Query_ help you query Loki for lists of labels or label values.
The Loki data source provides a form to select the type of values expected for a given variable.

The form has these options:

| Query type   | Example label | Example stream selector | List returned                                                    |
| ------------ | ------------- | ----------------------- | ---------------------------------------------------------------- |
| Label names  | Not required  | Not required            | Label names.                                                     |
| Label values | `label`       |                         | Label values for `label`.                                        |
| Label values | `label`       | `log stream selector`   | Label values for `label` in the specified `log stream selector`. |

## Use ad hoc filters

Loki supports ad hoc filters. Use them to specify any number of key/value filters that Grafana applies automatically to all of your Loki queries, without editing each query.

For more information, refer to [Add ad hoc filters](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#add-ad-hoc-filters).

## Use $\_\_auto variable for Loki metric queries

Consider using the `$__auto` variable in your Loki metric queries, which will automatically be substituted with the [step value](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/datasources/loki/query-editor/#options) for range queries, and with the selected time range's value (computed from the starting and ending times) for instant queries.

For more information about variables, refer to [Global built-in variables](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/#global-variables).

## Label extraction and indexing in Loki

Labels are key to how Loki aggregates and queries logs. Labels are `key-value` pairs that add contextual information to log entries, and Loki uses them to organize, filter, and search log data efficiently.

### Label extraction

When it ingests logs, Loki extracts labels from log lines using regular expressions, so you can define custom patterns that match your log formats. For example, given a log line like the following:

```text
2023-07-25 12:34:56 INFO: Request from IP A.B.C.D to endpoint /api/data
```

You can define a regular expression that extracts the log level (`INFO`), IP address (`A.B.C.D`), and endpoint (`/api/data`) as labels. You can then use those labels to filter and aggregate log entries.

### Index labels

Loki indexes the extracted labels. The index maps labels to their log entries, so Loki can retrieve logs by label without scanning the entire dataset. For example, if a `job` label represents the services in your application, Loki indexes each job's logs separately, so you can query a single job quickly.

Combine Loki's indexed labels with Grafana template variables to build dynamic queries. Use template variables to select and filter logs by labels such as job names, instance IDs, or severity levels, so you can explore and visualize your log data interactively.
