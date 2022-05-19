+++
title = "Labels and label matchers"
description = "Learn about labels and label matchers in alerting"
keywords = ["grafana", "alerting", "guide", "fundamentals"]
weight = 117
+++

# Labels and label matchers

To link alert rules to various other alerting concepts like [notification policies]() and [silences]() you make use of labels and label matchers.

This allows for a very flexible way to manage your alert instances, what policy should handle them and which alerts to silence.

## How label matching works

A label matchers consists of 3 distinct parts, the **label**, the **value** and the **operator**.

- The **Label** field is the name of the label to match. It must exactly match the label name.

- The **Value** field matches against the corresponding value for the specified **Label** name. How it matches depends on the **Operator** value.

- The **Operator** field is the operator to match against the label value. The available operators are:

| Operator | Description                                        |
| -------- | -------------------------------------------------- |
| `=`      | Select labels that are exactly equal to the value. |
| `!=`     | Select labels that are not equal to the value.     |
| `=~`     | Select labels that regex-match the value.          |
| `!~`     | Select labels that do not regex-match the value.   |

## Example

Imagine we've defined the following set of labels for our alert.

`{ foo=bar, baz=qux, id=12 }`

A label matcher defined as `foo=bar` will match this alert rule.

A label matcher defined as `foo!=bar` will _not_ match this alert rule.

A label matcher defined as `id=~[0-9]+` will match this alert rule.

A label matcher defined as `baz!~[0-9]+` will match this alert rule.
