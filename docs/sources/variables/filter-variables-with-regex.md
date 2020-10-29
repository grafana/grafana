+++
title = "Filter variables with regex"
keywords = ["grafana", "templating", "documentation", "guide", "template", "variable"]
type = "docs"
[menu.docs]
identifier = "filter-variables-regex"
parent = "variables"
weight = 700
+++


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
/.*[01|02]/
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

## Filter and use named text and value capture groups

This can be useful if the display text should differ from the value.

List of options:

```text
kube_pod_labels{label_description="a-descriptive-name-for-pod1",namespace="default",pod="pod1"}
kube_pod_labels{label_description="the-second-pod",namespace="default",pod="pod2"}
kube_pod_labels{label_description="a-special-pod",namespace="default",pod="pod3"}
```

Regex:

```regex
/pod="(?<value>[^"]+)|label_description="(?<text>[^"]+)/g
```

Result:

```text
value   text
pod1    a-descriptive-name-for-pod1
pod2    the-second-pod
pod3    a-sepcial-pod
```
