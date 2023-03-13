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
menuTitle: Template variables
title: Loki template variables
weight: 300
---

# Loki template variables

Instead of hard-coding details such as server, application, and sensor names in metric queries, you can use variables.
Grafana lists these variables in dropdown select boxes at the top of the dashboard to help you change the data displayed in your dashboard.
Grafana refers to such variables as template variables.

For an introduction to templating and template variables, refer to the [Templating]({{< relref "../../../dashboards/variables" >}}) and [Add and manage variables]({{< relref "../../../dashboards/variables/add-template-variables" >}}) documentation.

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

For more information, refer to [Add ad hoc filters]({{< relref "../../../dashboards/variables/add-template-variables#add-ad-hoc-filters" >}}).

## Use interval and range variables

You can use some global built-in variables in query variables: `$__interval`, `$__interval_ms`, `$__range`, `$__range_s`, and `$__range_ms`.

For more information, refer to [Global built-in variables]({{< relref "../../../dashboards/variables/add-template-variables#global-variables" >}}).
