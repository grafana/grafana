---
description: Learn about labels and label matchers in alerting
keywords:
  - grafana
  - alerting
  - guide
  - fundamentals
title: Label matchers
weight: 117
---

# How label matching works

Use labels and label matchers to link alert rules to [notification policies]({{< relref "../../notifications/" >}}) and [silences]({{< relref "../../silences/" >}}). This allows for a very flexible way to manage your alert instances, specify which policy should handle them, and which alerts to silence.

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

## Example of a label matcher

Imagine we've defined the following set of labels for our alert.

`{ foo=bar, baz=qux, id=12 }`

In this situation,

- A label matcher defined as `foo=bar` will match this alert rule.
- A label matcher defined as `foo!=bar` will _not_ match this alert rule.
- A label matcher defined as `id=~[0-9]+` will match this alert rule.
- A label matcher defined as `baz!~[0-9]+` will match this alert rule.
