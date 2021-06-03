+++
title = "Alerting Rules"
aliases = ["/docs/grafana/latest/alerting/rules/"]
+++

# Alerting Rules
One or more queries and/or expressions, a condition, the frequency of evaluation, and the (optional) duration that a condition must be met before creating an alert. Alerting rules are how you express the criteria for creating an alert. Queries and expressions select and can operate on the data you wish to alert on. A condition sets the threshold that an alert must meet or exceed to create an alert. The interval specifies how frequently the rule should be evaluated. The duration, when configured, sets a period that a condition must be met or exceeded before an alert is created. Alerting rules also can contain settings for what to do when your query does not return any data, or there is an error attempting to execute the query. 

- [View existing alert rules and their current state]({{< relref "./rule-list.md" >}})
- [Create Cortex or Loki managed alert rule]({{< relref "./create-cortex-loki-managed-rule.md" >}})
- [Create Grafana managed alert rule]({{< relref "./create-grafana-managed-rule.md" >}})
- [State and Health of alerting rules]({{< relref "./state-and-health.md" >}})
