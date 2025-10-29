---
canonical: https://grafana.com/docs/grafana/latest/alerting/best-practices/
description: This section provides a set of guides for useful alerting practices and recommendations
keywords:
  - grafana
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Best practices
title: Grafana Alerting best practices
weight: 170
---

# Grafana Alerting best practices

This section provides a set of guides and examples of best practices for Grafana Alerting. Here you can learn more about how to handle common alert management problems and you can see examples of more advanced usage of Grafana Alerting.

{{< section >}}

Designing and configuring an alert management set up that works takes time. Here are some additional tips on how to create an effective alert management set up:

{{< shared id="alert-planning-fundamentals" >}}

**Which are the key metrics for your business that you want to monitor and alert on?**

- Find events that are important to know about and not so trivial or frequent that recipients ignore them.
- Alerts should only be created for big events that require immediate attention or intervention.
- Consider quality over quantity.

**How do you want to organize your alerts and notifications?**

- Be selective about who you set to receive alerts. Consider sending them to the right teams, whoever is on call, and the specific channels.
- Think carefully about priority and severity levels.
- Automate as far as possible provisioning Alerting resources with the API or Terraform.

**Which information should you include in notifications?**

- Consider who the alert receivers and responders are.
- Share information that helps responders identify and address potential issues.
- Link alerts to dashboards to guide responders on which data to investigate.

**How can you reduce alert fatigue?**

- Avoid noisy, unnecessary alerts by using silences, mute timings, or pausing alert rule evaluation.
- Continually tune your alert rules to review effectiveness. Remove alert rules to avoid duplication or ineffective alerts.
- Continually review your thresholds and evaluation rules.

**How should you configure recording rules?**

- Use frequent evaluation intervals. It is recommended to set a frequent evaluation interval for recording rules. Long intervals, such as an hour, can cause the recorded metric to be stale and lead to misaligned alert rule evaluations, especially when combined with a long pending period.
- Understand query types. Grafana Alerting uses both **Instant** and **Range** queries. Instant queries fetch a single data point, while Range queries fetch a series of data points over time. When using a Range query in an alert condition, you must use a Reduce expression to aggregate the series into a single value.
- Align alert evaluation with recording frequency. The evaluation interval of an alert rule that depends on a recorded metric should be aligned with the recording rule's interval. If a recording rule runs every 3 minutes, the alert rule should also be evaluated at a similar frequency to ensure it acts on fresh data.
- Use `_over_time` functions for instant queries. Since all alert rules are ultimately executed as an instant query, you can use functions like `max_over_time(my_metric[1h])` as an instant query. This allows you to get an aggregated value over a period without using a range query and a reduce expression.
- Adjust pending periods carefully. The pending period for an alert rule should be configured with the recording rule's frequency in mind to avoid alerts firing or resolving incorrectly due to data staleness.

{{< /shared >}}
