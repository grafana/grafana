---
aliases:
  - ../fundamentals/annotation-label/variables-label-annotation/ # /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/annotation-label/variables-label-annotation/
  - ../alerting-rules/templating-labels-annotations/ # /docs/grafana/<GRAFANA_VERSION>/alerting-rules/templating-labels-annotations/
canonical: https://grafana.com/docs/grafana/latest/alerting/alerting-rules/templates/
description: Learn how to template annotations and labels to include data from queries and expressions in alert messages
keywords:
  - grafana
  - alerting
  - templating
  - labels
  - annotations
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Template annotations and labels
weight: 500
refs:
  explore:
    - pattern: /docs/
      destination: /docs/grafana/<GRAFANA_VERSION>/explore/
---

# Template annotations and labels

You can use templates to include data from queries and expressions in labels and annotations. For example, you might want to set the severity label for an alert based on the value of the query, or use the instance label from the query in a summary annotation so you know which server is experiencing high CPU usage.

When using custom labels with templates it is important to make sure that the label value does not change between consecutive evaluations of the alert rule as this will end up creating large numbers of distinct alerts. However, it is OK for the template to produce different label values for different alerts. For example, do not put the value of the query in a custom label as this will end up creating a new set of alerts each time the value changes. Instead use annotations.

All templates should be written in [text/template](https://pkg.go.dev/text/template). Regardless of whether you are templating a label or an annotation, you should write each template inline inside the label or annotation that you are templating. This means you cannot share templates between labels and annotations, and instead you will need to copy templates wherever you want to use them.

Each template is evaluated whenever the alert rule is evaluated, and is evaluated for every alert separately. For example, if your alert rule has a templated summary annotation, and the alert rule has 10 firing alerts, then the template will be executed 10 times, once for each alert. You should try to avoid doing expensive computations in your templates as much as possible.

{{% admonition type="caution" %}}
Extra whitespace in label templates can break matches with notification policies.
{{% /admonition %}}
