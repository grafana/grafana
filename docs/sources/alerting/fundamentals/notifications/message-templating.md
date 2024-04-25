---
aliases:
  - ../../contact-points/message-templating/ # /docs/grafana/<GRAFANA_VERSION>/alerting/contact-points/message-templating/
  - ../../alert-rules/message-templating/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alert-rules/message-templating/
  - ../../unified-alerting/message-templating/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/message-templating/
canonical: https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/message-templating/
description: Learn about templates
keywords:
  - grafana
  - alerting
  - guide
  - contact point
  - templating
labels:
  products:
    - cloud
    - enterprise
    - oss
title: Templates
weight: 114
---

## Templates

Use templating to customize, format, and reuse alert notification messages. Create more flexible and informative alert notification messages by incorporating dynamic content, such as metric values, labels, and other contextual information.

In Grafana, there are two ways to template your alert notification messages:

1. Labels and annotations

   - Template labels and annotations in alert rules.
   - Labels and annotations contain information about an alert.
   - Labels are used to differentiate an alert from all other alerts, while annotations are used to add additional information to an existing alert.

2. Notification templates

   - Template notifications in contact points.
   - Add notification templates to contact points for reuse and consistent messaging in your notifications.
   - Use notification templates to change the title, message, and format of the message in your notifications.

This diagram illustrates the entire process of templating, from the creation of labels and annotations in alert rules or notification templates in contact points, to what they look like when exported and applied in your alert notification messages.

{{< figure src="/media/docs/alerting/grafana-templating-diagram-2.jpg" max-width="1200px" caption="How Templating works" >}}

In this diagram:

- **Monitored Application**: A web server, database, or any other service generating metrics. For example, it could be an NGINX server providing metrics about request rates, response times, and so on.
- **Prometheus**: Prometheus collects metrics from the monitored application. For example, it might scrape metrics from the NGINX server, including labels like instance (the server hostname) and job (the service name).
- **Grafana**: Grafana queries Prometheus to retrieve metrics data. For example, you might create an alert rule to monitor NGINX request rates over time, and template labels or annotations based on the instance label.
- **Alertmanager**: Part of the Prometheus ecosystem, Alertmanager handles alert notifications. For example, if the request rate exceeds a certain threshold on a particular NGINX server, Alertmanager can send an alert notification to, for example, Slack or email, including the server name and the exceeded threshold (the instance label will be interpolated, and the actual server name will appear in the alert notification).
- **Alert notification**: When an alert rule condition is met, Alertmanager sends a notification to various channels such as Slack, Grafana OnCall, etc. These notifications can include information from the labels associated with the alerting rule. For example, if an alert triggers due to high CPU usage on a specific server, the notification message can include details like server name (instance label), disk usage percentage, and the threshold that was exceeded.
