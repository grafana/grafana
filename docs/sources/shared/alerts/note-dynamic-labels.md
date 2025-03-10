---
labels:
  products:
    - oss
title: 'Note Dynamic labels'
---

{{% admonition type="note" %}}

An alert instance is uniquely identified by its set of labels.

- Avoid displaying query values in labels, as this can create numerous alert instances—one for each distinct label set. Instead, use annotations for query values.
- If a templated label's value changes, it maps to a different alert instance, and the previous instance transitions to the `No data` state when its label value is no longer present.
  {{% /admonition %}}
