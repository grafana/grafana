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
---

# Loki template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating][variables] and [Add and manage variables][add-template-variables] documentation.

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

Loki supports the special **Ad hoc filters** variable type.
You can use this variable type to specify any number of key/value filters, and Grafana applies them automatically to all of your Loki queries.

For more information, refer to [Add ad hoc filters][add-template-variables-add-ad-hoc-filters].

## Use $\_\_auto variable for Loki metric queries

Consider using the `$__auto` variable in your Loki metric queries, which will automatically be substituted with the [step value](https://grafana.com/docs/grafana/next/datasources/loki/query-editor/#options) for range queries, and with the selected time range's value (computed from the starting and ending times) for instant queries.

For more information about variables, refer to [Global built-in variables][add-template-variables-global-variables].

## Label extraction and indexing in Loki

Labels play a fundamental role in Loki's log aggregation and querying capabilities. When logs are ingested into Loki, they are often accompanied by metadata called `labels`, which provide contextual information about the log entries. These labels consist of `key-value` pairs and are essential for organizing, filtering, and searching log data efficiently.

### Label extraction

During the ingestion process, Loki performs label extraction from log lines. Loki's approach to label extraction is based on `regular expressions`, allowing users to specify custom patterns for parsing log lines and extracting relevant label key-value pairs. This flexibility enables Loki to adapt to various log formats and schemas.

For example, suppose you have log lines in the following format:

**2023-07-25 12:34:56 INFO: Request from IP A.B.C.D to endpoint /api/data**

To extract labels from this log format, you could define a regular expression to extract the log level ("INFO"), IP address ("A.B.C.D"), and endpoint ("/api/data") as labels. These labels can later be used to filter and aggregate log entries.

### Indexing labels

Once labels are extracted, Loki efficiently indexes them. The index serves as a lookup mechanism that maps labels to the corresponding log entries. This indexing process enables faster retrieval of logs based on specific label criteria, significantly enhancing query performance.

For instance, if you have a label "job" that represents different services in your application, Loki will index the logs for each job separately. This indexing allows you to quickly query and analyze logs for individual jobs without the need to scan the entire log dataset.

By effectively extracting and indexing labels, Loki enables users to perform complex and targeted log queries without compromising on query speed and resource consumption.

Utilizing Loki's indexed labels in combination with Grafana's template variables provides a powerful way to interactively explore and visualize log data. Template variables allow users to create dynamic queries, selecting and filtering logs based on various labels, such as job names, instance IDs, severity levels, or any other contextual information attached to the log entries.

In conclusion, Loki's label extraction and indexing mechanisms are key components that contribute to its ability to handle vast amounts of log data efficiently. By making use of labels and template variables, users can easily gain valuable insights from their log data and troubleshoot issues effectively.

{{% docs/reference %}}
[add-template-variables-add-ad-hoc-filters]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables#add-ad-hoc-filters"
[add-template-variables-add-ad-hoc-filters]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables#add-ad-hoc-filters"

[add-template-variables-global-variables]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables#global-variables"
[add-template-variables-global-variables]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables#global-variables"

[add-template-variables]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables"
[add-template-variables]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables/add-template-variables"

[variables]: "/docs/grafana/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables"
[variables]: "/docs/grafana-cloud/ -> /docs/grafana/<GRAFANA VERSION>/dashboards/variables"
{{% /docs/reference %}}
