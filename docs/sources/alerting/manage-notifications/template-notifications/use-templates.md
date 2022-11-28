---
aliases:
keywords:
  - grafana
  - alerting
  - notifications
  - templates
  - use templates
title: Use templates
weight: 300
---

# Use message templates

To use message templates when sending notifications you must [execute a template]({{< relref "#executing-a-template" >}}) from within a contact point. To execute a template you use the `template` directive, followed by the name of the template, and the cursor to be passed to the template. If you are unfamiliar with how to write templates, the `template` directive, or cursors check out [how to write templates]({{< relref "./write-templates" >}}).

{{< figure max-width="940px" src="/static/img/docs/alerting/unified/use-message-template-9-3.png" caption="Use message template" >}}
