---
labels:
  products:
    - enterprise
    - oss
title: 'How label matching works'
---

{{< collapse title="How label matching works" >}}

Use [labels](ref:shared-alert-labels) and label matchers to link alert rules to [notification policies](ref:shared-notification-policies) and [silences](ref:shared-silences). This allows for a flexible way to manage your alert instances, specify which policy should handle them, and which alerts to silence.

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

{{< admonition type="note" >}}
If you are using multiple label matchers, they are combined using the AND logical operator. This means that all matchers must match in order to link a rule to a policy.
{{< /admonition >}}

**Label matching example**

If you define the following set of labels for your alert:

`{ foo=bar, baz=qux, id=12 }`

then:

- A label matcher defined as `foo=bar` matches this alert rule.
- A label matcher defined as `foo!=bar` does _not_ match this alert rule.
- A label matcher defined as `id=~[0-9]+` matches this alert rule.
- A label matcher defined as `baz!~[0-9]+` matches this alert rule.
- Two label matchers defined as `foo=bar` and `id=~[0-9]+` match this alert rule.

**Exclude labels**

You can also write label matchers to exclude labels.

Here is an example that shows how to exclude the label `Team`. You can choose between any of the values below to exclude labels.

| Label  | Operator | Value |
| ------ | -------- | ----- |
| `team` | `=`      | `""`  |
| `team` | `!~`     | `.+`  |
| `team` | `=~`     | `^$`  |

{{< /collapse >}}
