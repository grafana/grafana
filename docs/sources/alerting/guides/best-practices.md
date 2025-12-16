---
aliases:
  - ../best-practices/ # /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/
canonical: https://grafana.com/docs/grafana/latest/alerting/guides/best-practices/
description: Learn how to detect missing metrics and design alerts that handle gaps in data in Prometheus and Grafana Alerting.
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - create
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Best practices
title: Best practices
weight: 1010
---

# Best practices

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

{{< /shared >}}
