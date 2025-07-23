---
aliases:
keywords:
  - grafana
  - documentation
  - guide
  - variable
  - global
  - standard
  - nested
  - chained
  - linked
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Query variables
title: Add query variables
description: 
weight: 1000
refs:
  add:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/add-template-variables/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/add-template-variables/
  inspect:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/inspect-variable/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/inspect-variable/
  prometheus-query-variables:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/prometheus/template-variables/#use-**rate_interval
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/prometheus/template-variables/#use-**rate_interval
  raw-variable-format:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#raw
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/variable-syntax/#raw
  data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/
  raw-format:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/variables/variable-syntax/#raw
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/variables/variable-syntax/#raw
  add-a-data-source:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/datasources/#add-a-data-source
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/connect-externally-hosted/data-sources/#add-a-data-source
  filter-dashboard:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/dashboards/use-dashboards/#filter-dashboard-data
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/dashboards/use-dashboards/#filter-dashboard-data
---

# Add query variables

<!-- vale Grafana.Spelling = NO -->

## Add a query variable

To create a query variable, follow these steps:

1. Click **Edit** in the top-right corner of the dashboard.
1. Click **Settings**.
1. Go to the **Variables** tab.
1. Click **Add variable**, or if there are already existing variables, **+ New variable**.
1. Select **Query** in the **Variable type** drop-down list.
1. Set the following options:
   <!-- prettier-ignore-start -->
   | Option | Description |
   | ------ | ----------- |
   | Name | Required |
   | Label | the display name for the variable drop-down list. If you don't enter a display name, then the drop-down list label is the variable name. |
   | Description |  |
   | Hide | Choose a **** option to control how the variable selector is displayed:<ul><li>**Nothing** The variable name or label and values are displayed in the drop-down list. This is the default selection.</li><li>- **Variable** - The variable drop-down list isn't displayed.</li><li>**Label** The variable drop-down list only displays the variable values.</li></ul> |
   | Data source | Select a **** for the query. |
   | Query type | Depending on the data source you've chosen, make a selection in the **** drop-down list | 
   | Query | type a query into the **** field. | 
   | [Regex] | Enter an expression in the **** field to extract part of a series name or metric node segment. For examples, refer to [Filter variables with regular expressions] (#filter-variables-with-regex) section of this page. | 
   | Sort | set how the values are ordered in the variable drop-down list. | 
   | Refresh | Choose a **** option to control when the values of the variable are updated:<ul><li>On dashboard load</li><li>On time range change</li></ul> | 
   | Use static options | Toggle the **** switch to add custom options. | 
   | Static options sort | If you enabled static options, use the **** to control how they're ordered with query values. |
   | [Multi-value] | allow multiple values to be selected at the same time. For more information about multi-value variables, refer to the [x](#multi-value-variables) section of this page. |
   | Allow custom values | allow for custom values to be added to the list.|
   | [Include All option] | enable an option to include all values. |
   | [Custom all value] | To give a the "All" value a custom name, enter a name in **** text field. This field is only displayed if you enabled **Include All option**. There'll be a preview. |
   <!-- prettier-ignore-end -->
1. Click **Run query** (should something happen here??).

<!-- vale Grafana.Spelling = YES -->
<!-- vale Grafana.WordList = YES -->

## Filter variables with regular expressions {#filter-variables-with-regex}

<!-- vale Grafana.WordList = NO -->

Using the **Regex** query option, you filter the list of options returned by the variable query or modify the options returned.

This page shows how to use a regular expression to filter/modify values in the variable dropdown.

Using the **Regex** query option, you filter the list of options returned by the Variable query or modify the options returned. For more information, refer to the Mozilla guide on [Regular expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).

Examples of filtering on the following list of options:

```text
backend_01
backend_02
backend_03
backend_04
```

### Filter so that only the options that end with `01` or `02` are returned:

**Regex**:

```regex
/(01|02)$/
```

Result:

```text
backend_01
backend_02
```

### Filter and modify the options using a regular expression to capture group to return part of the text:

**Regex**:

```regex
/.*(01|02)/
```

Result:

```text
01
02
```

### Filter and modify - Prometheus Example

List of options:

```text
up{instance="demo.robustperception.io:9090",job="prometheus"} 1 1521630638000
up{instance="demo.robustperception.io:9093",job="alertmanager"} 1 1521630638000
up{instance="demo.robustperception.io:9100",job="node"} 1 1521630638000
```

**Regex**:

```regex
/.*instance="([^"]*).*/
```

Result:

```text
demo.robustperception.io:9090
demo.robustperception.io:9093
demo.robustperception.io:9100
```

### Filter and modify using named text and value capture groups

Using named capture groups, you can capture separate 'text' and 'value' parts from the options returned by the variable query. This allows the variable drop-down list to contain a friendly name for each value that can be selected.

For example, when querying the `node_hwmon_chip_names` Prometheus metric, the `chip_name` is a lot friendlier than the `chip` value. So the following variable query result:

```text
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_0",chip_name="enp216s0f0np0"} 1
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_1",chip_name="enp216s0f0np1"} 1
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_2",chip_name="enp216s0f0np2"} 1
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_3",chip_name="enp216s0f0np3"} 1
```

Passed through the following regular expression:

```regex
/chip_name="(?<text>[^"]+)|chip="(?<value>[^"]+)/g
```

Would produce the following drop-down list:

```text
Display Name          Value
------------          -------------------------
enp216s0f0np0         0000:d7:00_0_0000:d8:00_0
enp216s0f0np1         0000:d7:00_0_0000:d8:00_1
enp216s0f0np2         0000:d7:00_0_0000:d8:00_2
enp216s0f0np3         0000:d7:00_0_0000:d8:00_3
```

{{< admonition type="note" >}}
Only `text` and `value` capture group names are supported.
{{< /admonition >}}

## Multi-value variables

Interpolating a variable with multiple values selected is tricky as it is not straight forward how to format the multiple values into a string that is valid in the given context where the variable is used. Grafana tries to solve this by allowing each data source plugin to inform the templating interpolation engine what format to use for multiple values.

{{< admonition type="note" >}}
The **Custom all value** option on the variable must be blank for Grafana to format all values into a single string. If it is left blank, then Grafana concatenates (adds together) all the values in the query. Something like `value1,value2,value3`. If a custom `all` value is used, then instead the value is something like `*` or `all`.
{{< /admonition >}}

#### Multi-value variables with a Graphite data source

Graphite uses glob expressions. A variable with multiple values would, in this case, be interpolated as `{host1,host2,host3}` if the current variable value was _host1_, _host2_, and _host3_.

#### Multi-value variables with a Prometheus or InfluxDB data source

InfluxDB and Prometheus use regular expressions, so the same variable would be interpolated as `(host1|host2|host3)`. Every value would also be regular expression escaped. If not, a value with a regular expression control character would break the regular expression.

#### Multi-value variables with an Elastic data source

Elasticsearch uses Lucene query syntax, so the same variable would be formatted as `("host1" OR "host2" OR "host3")`. In this case, every value must be escaped so that the value only contains Lucene control words and quotation marks.

#### Troubleshoot multi-value variables

Automatic escaping and formatting can cause problems and it can be tricky to grasp the logic behind it. Especially for InfluxDB and Prometheus where the use of regular expression syntax requires that the variable is used in regular expression operator context.

If you do not want Grafana to do this automatic regular expression escaping and formatting, then you must do one of the following:

- Turn off the **Multi-value** or **Include All option** options.
- Use the [raw variable format](ref:raw-variable-format).

## Include All option

Grafana adds an `All` option to the variable dropdown list. If a user selects this option, then all variable options are selected.

### Custom all value

This option is only visible if the **Include All option** is selected.

Enter regular expressions, globs, or Lucene syntax in the **Custom all value** field to define the value of the `All` option.

By default the `All` value includes all options in combined expression. This can become very long and can have performance problems. Sometimes it can be better to specify a custom all value, like a wildcard regular expression.

In order to have custom regular expression, globs, or Lucene syntax in the **Custom all value** option, it is never escaped so you have to think about what is a valid value for your data source.
