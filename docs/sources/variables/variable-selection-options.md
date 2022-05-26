---
title: Variable selection options
weight: 400
---

# Configure variable selection options

**Selection Options** are a feature you can use to manage variable option selections. All selection options are optional, and they are off by default.

## Multi-value

If you turn this on, then the variable dropdown list allows users to select multiple options at the same time. For more information, refer to [Formatting multi-value variables]({{< relref "formatting-multi-value-variables.md" >}}).

## Include All option

Grafana adds an `All` option to the variable dropdown list. If a user selects this option, then all variable options are selected.

## Custom all value

This option is only visible if the **Include All option** is selected.

Enter regex, globs, or lucene syntax in the **Custom all value** field to define the value of the `All` option.

By default the `All` value includes all options in combined expression. This can become very long and can have performance problems. Sometimes it can be better to specify a custom all value, like a wildcard regex.

In order to have custom regex, globs, or lucene syntax in the **Custom all value** option, it is never escaped so you will have to think about what is a valid value for your data source.
