---
keywords:
  - grafana
  - templating
  - documentation
  - guide
  - template
  - variable
title: Filter variables with regex
weight: 700
---

# Filter variables with regex

Using the Regex Query option, you filter the list of options returned by the variable query or modify the options returned.

This page shows how to use regex to filter/modify values in the variable dropdown.

Using the Regex Query Option, you filter the list of options returned by the Variable query or modify the options returned. For more information, refer to the Mozilla guide on [Regular expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions).

Examples of filtering on the following list of options:

```text
backend_01
backend_02
backend_03
backend_04
```

## Filter so that only the options that end with `01` or `02` are returned:

Regex:

```regex
/(01|02)$/
```

Result:

```text
backend_01
backend_02
```

## Filter and modify the options using a regex capture group to return part of the text:

Regex:

```regex
/.*(01|02)/
```

Result:

```text
01
02
```

## Filter and modify - Prometheus Example

List of options:

```text
up{instance="demo.robustperception.io:9090",job="prometheus"} 1 1521630638000
up{instance="demo.robustperception.io:9093",job="alertmanager"} 1 1521630638000
up{instance="demo.robustperception.io:9100",job="node"} 1 1521630638000
```

Regex:

```regex
/.*instance="([^"]*).*/
```

Result:

```text
demo.robustperception.io:9090
demo.robustperception.io:9093
demo.robustperception.io:9100
```

## Filter and modify using named text and value capture groups

> **Note:** This feature is available in Grafana 7.4+.

Using named capture groups, you can capture separate 'text' and 'value' parts from the options returned by the variable query. This allows the variable drop-down list to contain a friendly name for each value that can be selected.

For example, when querying the `node_hwmon_chip_names` Prometheus metric, the `chip_name` is a lot friendlier that the `chip` value. So the following variable query result:

```text
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_0",chip_name="enp216s0f0np0"} 1
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_1",chip_name="enp216s0f0np1"} 1
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_2",chip_name="enp216s0f0np2"} 1
node_hwmon_chip_names{chip="0000:d7:00_0_0000:d8:00_3",chip_name="enp216s0f0np3"} 1
```

Passed through the following Regex:

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

**Note:** Only `text` and `value` capture group names are supported.
