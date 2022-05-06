+++
title = "Label matching and alert suppression"
description = "Silences alert notifications"
keywords = ["grafana", "alerting", "silence", "mute"]
weight = 452
aliases = ["/docs/grafana/latest/alerting/unified-alerting/silences/"]
+++

# About label matching for alert suppression

Grafana suppresses notifications only for alerts with labels that match all the "Matching Labels" specified in the silence.

- The **Label** field is the name of the label to match. It must exactly match the label name.
- The **Operator** field is the operator to match against the label value. The available operators are:

  - `=`: Select labels that are exactly equal to the provided string.
  - `!=`: Select labels that are not equal to the provided string.
  - `=~`: Select labels that regex-match the provided string.
  - `!~`: Select labels that do not regex-match the provided string.

- The **Value** field matches against the corresponding value for the specified **Label** name. How it matches depends on the **Operator** value.
