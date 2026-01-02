---
aliases:
  - ../best-practices/ # /docs/grafana/<GRAFANA_VERSION>/alerting/best-practices/
canonical: https://grafana.com/docs/grafana/latest/alerting/guides/best-practices/
description: Designing and configuring an effective alerting system takes time. This guide focuses on building alerting systems that scale with real-world operations.
keywords:
  - grafana
  - alerting
  - guide
labels:
  products:
    - cloud
    - enterprise
    - oss
menuTitle: Best practices
title: Best practices
weight: 1010
refs:
  recovery-threshold:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/queries-conditions/#recovery-threshold
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/fundamentals/alert-rules/queries-conditions/#recovery-threshold
  keep-firing-for:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/#keep-firing-for
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/fundamentals/alert-rule-evaluation/#keep-firing-for
  pending-period:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/#pending-period
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/fundamentals/alert-rule-evaluation/#pending-period
  silences:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/configure-notifications/create-silence/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/configure-notifications/create-silence/
  timing-options:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/group-alert-notifications/#timing-options
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/group-alert-notifications/#timing-options
  group-alert-notifications:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/group-alert-notifications/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/group-alert-notifications/
  notification-policies:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/notifications/notification-policies/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/notifications/notification-policies/
  annotations:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rules/annotation-label/#annotations
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rules/annotation-label/#annotations
  multi-dimensional-alerts:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/examples/multi-dimensional-alerts/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/examples/multi-dimensional-alerts/
---

# Alerting best practices

Designing and configuring an effective alerting system takes time. This guide focuses on building alerting systems that scale with real-world operations.

The practices described here apply regardless of tooling. Whether you use Prometheus, Grafana Alerting, or another stack, the same constraints apply: complex systems, imperfect signals, and humans on call.

Alerting is never finished. It evolves with incidents, organizational changes, and the systems it’s meant to protect.

{{< shared id="alert-planning-fundamentals" >}}

## Prioritize symptoms, but don’t ignore infrastructure signals

Alerts should primarily detect user-facing failures, not internal component behavior. Users don't care that a pod restarted; they care when the application is slow or failing. Symptom-based alerts tie directly to user impact.

Reliability metrics that impact users—latency, errors, availability—are better paging signals than infrastructure events or internal errors.

That said, infrastructure signals still matter. They can act as early warning indicators and are often useful when alerting maturity is low. A sustained spike in CPU or memory usage might not justify a page, but it can help explain or anticipate symptom-based failures.

Infrastructure alerts tend to be noisy and are often ignored when treated like paging signals. They are usually better suited for lower-severity channels such as dashboards, alert lists, or non-paging destinations like a dedicated Slack channel, where they can be monitored without interrupting on-call.

The key is balance as your alerting matures. Use infrastructure alerts to support diagnosis and prevention, not as a replacement for symptom-based alerts.

## Escalate priority based on confidence

Alert priority is often tied to user impact and the urgency to respond, but confidence should determine when escalation is necessary.

In this context, escalation defines how responders are notified as confidence grows. This can include increasing alert priority, widening notification, paging additional responders, or opening an incident once intervention is clearly required.

Early signals are often ambiguous, and confidence in a non-transient failure is usually low. Paging too early creates noise; paging too late means users are impacted for longer before anyone acts. A small or sudden increase in latency may not justify immediate action, but it can indicate a failure in progress.

Confidence increases as signals become stronger or begin to correlate.

Escalation is justified when issues are sustained or reinforced by multiple signals. For example, high latency combined with a rising error rate, or the same event firing over a sustained period. These patterns reduce the chance of transient noise and increase the likelihood of real impact.

Use confidence in user impact to drive escalation and avoid unnecessary pages.

## Scope alerts for scalability and actionability

In distributed systems, avoid creating separate alert rules for every host, service, or endpoint. Instead, define alert rules that scale automatically using [multi-dimensional alert rules](ref:multi-dimensional-alerts). This reduces rule duplication and allows alerting to scale as the system grows.

Start simple. Default to a single dimension such as `service` or `endpoint` to keep alerts manageable. Add dimensions only when they improve actionability. For example, when missing a dimension like `region` hides failures or doesn't provide enough information to act quickly.

Additional dimensions like `region` or `instance` can help identify the root cause, but more isn't always better.

## Design alerts for first responders and clear actions

Alerts should be designed for the first responder, not the person who created the alert. Anyone on call should be able to understand what's wrong and what to do next without deep knowledge of the system or alert configuration.

Avoid vague alerts that force responders to spend time figuring out context. Every alert should clearly explain why it exists, what triggered it, and how to investigate. Use [annotations](ref:annotations) to link to relevant dashboards and runbooks, which are essential for faster resolution.

Alerts should indicate a real problem and be actionable, even if the impact is low. Informational alerts add noise without improving reliability.

If no action is possible, it shouldn't be an alert—consider using a dashboard instead. Over time, alerts behave like technical debt: easy to create, costly to maintain, and hard to remove.

Review alerts often and remove those that don’t lead to action.

## Alerts should have an owner and system scope

Alerts without ownership are often ignored. Every alert must have an owner: a team responsible for maintaining the alert and responding when it fires.

Alerts must also define a system scope, such as a service or infrastructure component. Scope provides organizational context and connects alerts with ownership. Defining clear scopes is easier when services are treated as first-class entities, and organizations are built around service ownership.

> [Service Center in Grafana Cloud](/docs/grafana-cloud/alerting-and-irm/service-center/) can help operate a service-oriented view of your system and align alert scope with ownership.

After scope, ownership, and alert priority are defined, routing determines where alerts go and how they escalate. **Notification routing is as important as the alerts**.

Alerts should be delivered to the right team and channel based on priority, ownership, and team workflows. Use [notification policies](ref:notification-policies) to define a routing tree that matches the context of your service or scope:

- Define a parent policy for default routing within the scope.
- Define nested policies for specific cases or higher-priority issues.

## Grouping prevents notification overload

Without alert grouping, responders can receive many notifications for the same underlying problem.

For example, a database failure can trigger several alerts at the same time like increased latency, higher error rates, and internal errors. Paging separately for each symptom quickly turns into notification spam, even though there is a single root cause.

[Notification grouping](ref:group-alert-notifications) consolidates related alerts into a single notification. Instead of receiving multiple pages for the same issue, responders get one alert that represents the incident and includes all related firing alerts.

Grouping should follow operational boundaries such as service or owner, as defined by notification policies. Downstream or cascading failures should be grouped together so they surface as one issue rather than many.

Configure [timing options](ref:timing-options) along with [silences](ref:silences) to reduce repeated notifications during active incidents.

## Mitigate flapping alerts

Short-lived failure spikes often trigger alerts that auto-resolve quickly. Alerting on transient failures creates noise and leads responders to ignore them.

Require issues to persist before alerting. Set a [pending period](ref:pending-period) to define how long a condition must remain true before firing. For example, instead of alerting immediately on high error rate, require it to stay above the threshold for some minutes.

Also, stabilize alerts by tuning query ranges and aggregations. Using raw data makes alerts sensitive to noise. Instead, evaluate over a time window and aggregate the data to smooth short spikes.

```promql
# Reacts to transient spikes. Avoid this.
cpu_usage > 90

# Smooth fluctuations.
avg_over_time(cpu_usage[5m]) > 90
```

For latency and error-based alerts, percentiles are often more useful than averages:

```promql
quantile_over_time(0.95, http_duration_seconds[5m]) > 3
```

Finally, avoid rapid resolve-and-fire notifications by using [`keep_firing_for`](ref:keep-firing-for) or [recovery thresholds](ref:recovery-threshold) to keep alerts active briefly during recovery. Both options reduce flapping and unnecessary notifications.

## Graduate symptom-based alerts into SLOs

When a symptom-based alert fires frequently, it usually indicates a reliability concern that should be measured and managed more deliberately. This is often a sign that the alert could evolve into an [SLO](/docs/grafana-cloud/alerting-and-irm/slo/).

Traditional alerts create pressure to react immediately, while error budgets introduce a buffer of time to act, changing how urgency is handled. Alerts can then be defined in terms of error budget burn rate rather than reacting to every minor deviation.

SLOs also align distinct teams around common reliability goals by providing a shared definition of what "good" looks like. They help consolidate multiple symptom alerts into a single user-facing objective.

For example, instead of several teams alerting on high latency, a single SLO can be used across teams to capture overall API performance.

## Integrate alerting into incident post-mortems

Every incident is an opportunity to improve alerting. After each incident, evaluate whether alerts helped responders act quickly or added unnecessary noise.

Assess which alerts fired, and how they influenced incident response. Review whether alerts triggered too late, too early, or without enough context, and adjust thresholds, priority, or escalation based on what actually happened.

Post-mortems should evaluate alerts with root causes and lessons learned. If responders lacked key information during the incident, enrich alerts with additional context, dashboards, or better guidance.

## Alerts should be continuously improved

Alerting is an iterative process. Alerts that aren’t reviewed and refined lose effectiveness as systems and traffic patterns change.

Schedule regular reviews of existing alerts. Remove alerts that don’t lead to action, and tune alerts or thresholds that fire too often without providing useful signal. Reduce false positives to combat alert fatigue.

Prioritize clarity and simplicity in alert design. Simpler alerts are easier to understand, maintain, and trust under pressure. Favor fewer high-quality, actionable alerts over a large number of low-value ones.

Use dashboards and observability tools for investigation, not alerts.

{{< /shared >}}
