---
aliases:
  - ../../data-sources/google-cloud-monitoring/template-variables/
description: Guide for using template variables when querying the Google Cloud Monitoring
  data source
keywords:
  - grafana
  - google
  - cloud
  - monitoring
  - queries
  - template
  - variable
menuTitle: Template variables
title: Google Cloud Monitoring template variables
weight: 300
---

# Google Cloud Monitoring template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating]({{< relref "../../../dashboards/variables" >}}) and [Add and manage variables]({{< relref "../../../dashboards/variables/add-template-variables" >}}) documentation.

## Use query variables

Variables of the type _Query_ help you query Google Cloud Monitoring for various types of data.
The Google Cloud Monitoring data source plugin provides the following **Query Types**:

| Name                               | List returned                                                         |
| ---------------------------------- | --------------------------------------------------------------------- |
| **Metric Types**                   | Metric type names available for the specified service.                |
| **Labels Keys**                    | Keys for `metric label` and `resource label` in the specified metric. |
| **Labels Values**                  | Values for the label in the specified metric.                         |
| **Resource Types**                 | Resource types for the specified metric.                              |
| **Aggregations**                   | Aggregations (cross-series reducers) for the specified metric.        |
| **Aligners**                       | Aligners (per-series aligners) for the specified metric.              |
| **Alignment periods**              | All alignment periods available in the query editor in Grafana.       |
| **Selectors**                      | Selectors for SLO (Service Level Objectives) queries.                 |
| **SLO Services**                   | Service Monitoring services for SLO queries.                          |
| **Service Level Objectives (SLO)** | SLOs for the specified SLO service.                                   |

## Use variables in queries

Use Grafana's variable syntax to include variables in queries.
For details, refer to the [variable syntax documentation]({{< relref "../../../dashboards/variables/variable-syntax" >}}).
