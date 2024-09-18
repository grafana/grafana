---
aliases:
  - ../../alerting/alerting-rules/view-state-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/view-state-health
canonical: https://grafana.com/docs/grafana/latest/alerting/manage-notifications/view-state-health/
description: View the state and health of alert rules
keywords:
  - grafana
  - alert rules
  - keep last state
  - guide
  - state
  - health
labels:
  products:
    - cloud
    - enterprise
    - oss
title: View alert state and history
weight: 420
refs:
  alert-rule-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-rule-state
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-rule-state
  alert-rule-evaluation:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/
  alert-instance-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-instance-state
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-instance-state
  alert-rule-health:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-rule-health
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/state-and-health/#alert-rule-health
---

# View alert state and history

An alert rule and its corresponding alert instances can transition through distinct states during their [evaluation](ref:alert-rule-evaluation). There are three key components that helps us understand the behavior of our alerts:

- [Alert Instance State](ref:alert-instance-state): Refers to the state of the individual alert instances.
- [Alert Rule State](ref:alert-rule-state): Determined by the "worst state" among its alert instances.
- [Alert Rule Health](ref:alert-rule-health): Indicates the status in cases of `Error` or `NoData` events.

To view the state and health of your alert rules:

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
1. Click **Alert rules** to view the list of existing alerts.
1. Click an alert rule to view its state, health, and state history.

## View state history

Use the State history view to get insight into how your alert instances behave over time. View information on when a state change occurred, what the previous state was, the current state, any other alert instances that changed their state at the same time as well as what the query value was that triggered the change.

{{% admonition type="note" %}}
Open source users must [configure alert state history](/docs/grafana/latest/alerting/set-up/configure-alert-state-history/) in order to be able to access the view.
{{% /admonition %}}

To access the State history view, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Alert rules**.
1. Click an alert rule.
1. Select **Show state history**.

   The State history view opens.

   The timeline view at the top displays a timeline of changes for the past hour, so you can track how your alert instances are behaving over time.

   The bottom part shows the alert instances, their previous and current state, the value of each part of the expression and a unique set of labels.

   Common labels are displayed at the top to make it easier to identify different alert instances.

1. From the timeline view, hover over a time to get an automatic display of all the changes that happened at that particular moment.

   These changes are displayed in real time in the timestamp view at the bottom of the page. The timestamp view is a list of all the alert instances that changed state at that point in time. The visualization only displays 12 instances by default.

   The value shown for each instance is for each part of the expression that was evaluated.

1. Click the labels to filter and narrow down the results.

   {{< figure src="/media/docs/alerting/state-history.png" max-width="750px" >}}
