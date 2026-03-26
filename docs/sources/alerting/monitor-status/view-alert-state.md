---
aliases:
  - ../../alerting/alerting-rules/view-state-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/view-state-health
  - ../../alerting/manage-notifications/view-state-health/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/view-state-health/
  - ../../alerting/manage-notifications/view-alert-state-on-panels/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/view-alert-state-on-panels/
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-state/
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
title: View alert state
weight: 420
refs:
  alert-list-panel:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/panels-visualizations/visualizations/alert-list/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/visualizations/panels-visualizations/visualizations/alert-list/
  link-alert-rules-to-panels:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/link-alert-rules-to-panels/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/alerting-rules/link-alert-rules-to-panels/
  alert-rule-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/alert-rule-state-and-health/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/alert-rule-state-and-health/
  alert-instance-state:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/#alert-instance-states
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/nodata-and-error-states/#alert-instance-states
  alert-rule-health:
    - pattern: /docs/grafana/
      destination: /docs/grafana/<GRAFANA_VERSION>/alerting/fundamentals/alert-rule-evaluation/alert-rule-state-and-health/
    - pattern: /docs/grafana-cloud/
      destination: /docs/grafana-cloud/alerting-and-irm/alerting/fundamentals/alert-rule-evaluation/alert-rule-state-and-health/
---

# View alert state

An alert rule and its corresponding alert instances can transition through distinct states during the alert rule evaluation.

{{< figure src="/media/docs/alerting/alert-state-diagram2.png" alt="A diagram of the distinct alert instance states and transitions." max-width="750px" >}}

There are three key components that helps us understand the behavior of our alerts:

- [Alert Instance State](ref:alert-instance-state): Refers to the state of the individual alert instances.
- [Alert Rule State](ref:alert-rule-state): Determined by the "worst state" among its alert instances.
- [Alert Rule Health](ref:alert-rule-health): Indicates the status in cases of `Error` or `NoData` events.

## View alert rule and instance states

To view the details of your alert rules and the status of alert instances:

1. Click **Alerts & IRM** -> **Alerting**.
1. Click **Alert rules** to view the list of existing alert rules.

   {{< figure src="/media/docs/alerting/view-alert-rule-list-with-actions2.png" max-width="750px" alt="View alert rule state and alert rule health in Grafana Alerting" >}}

   Each alert rule shows its state, summary, and available actions such as **Pause evaluation**, **Silence notifications**, **Export**, **Delete**, and more.

1. Click on an alert rule to view additional details and its resulting alert instances.

### View from the alert rule details page

To view more alert rule details, complete the following steps.

1. Click **Alerts & IRM** -> **Alerting** -> **Alert rules**.
1. Click to expand an alert rule.
1. Click the alert name to go to the alert details view.

   {{< figure src="/media/docs/alerting/alert-rule-view-page-with-breadcrumb.png" max-width="750px" alt="Alert rule view page in Grafana Alerting" >}}

   The namespace and group are shown in the breadcrumb navigation. They are interactive and can be used to filter rules by namespace or group.

   The rest of the alert detail content is split up into tabs:

   **Query and conditions**

   View the details of the query that is used for the alert rule, including the expressions and intermediate values for each step of the expression pipeline. A graph view is included for range queries and data sources that return time series-like data frames.

   **Instances**

   Explore each alert instance, its status, labels and various other metadata for multi-dimensional alert rules.

   Use **Search by label** to enter search criteria using label selectors. For example, `environment=production,region=~US|EU,severity!=warning`.

   **History**

   Explore the recorded history for an alert rule. You can also filter by alert state.

   **Details**

   Debug or audit using the alert rule metadata and view the alert rule annotations.

## View alert state on panels

When an [alert rule is linked to a time series panel](ref:link-alert-rules-to-panels), the time series panel displays the alert state and alert events.

A heart icon near the panel title shows the current alert state:

- A broken red heart when the alert is in `Alerting` state.
- A green heart when the alert is in `Normal` state.

Colored annotations indicate changes in alert state, such as pending, alerting, and resolving.

{{< figure src="/media/docs/alerting/panel-displays-alert-state.png" max-width="1200px" alt="A panel with a firing alert and annotations that display the pending and alerting state changes." >}}

Additionally, Grafana provides an [alert list panel](ref:alert-list-panel) that you can add to a dashboard to display a list of alerts and their states.

{{< figure src="/static/img/docs/alert-list-panel/alert-list-panel.png" max-width="850px" alt="Two alert list panels displaying distinct lists of alerts." >}}

You can configure the alert list panel with various visualization options and filters to control how alerts are displayed. For more details, refer to the [Alert list documentation](ref:alert-list-panel).

{{< docs/play title="this demo dashboard with alert list panels and linked alert rules" url="https://play.grafana.org/d/000000074/alerting?tech=docs&pg=alerting-demo&plcmt=callout-play&cta=alert-demo-dashboard" >}}

## View alert state history

Use the State history view to get insight into how your individual alert instances behave over time.

View information on when a state change occurred, what the previous state was, the current state, any other alert instances that changed their state at the same time as well as what the query value was that triggered the change.

To access the State history view, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Alert rules**.
1. Click an alert rule.
1. Click the **History** tab.

   {{< figure src="/media/docs/alerting/alerting-state-history-view.png" max-width="750px" alt="State history view in Grafana Alerting" >}}

   The timeline view at the top displays a timeline of changes for the past hour, so you can track how your alert instances are behaving over time.

   The bottom part shows the alert instances, their previous and current state, the value of each part of the expression and a unique set of labels.

   Common labels are displayed at the top to make it easier to identify different alert instances.

1. From the timeline view, hover over a time to get an automatic display of all the changes that happened at that particular moment.

   These changes are displayed in real time in the timestamp view at the bottom of the page. The timestamp view is a list of all the alert instances that changed state at that point in time. The visualization only displays 12 instances by default.

   The value shown for each instance is for each part of the expression that was evaluated.

1. Click the labels to filter and narrow down the results.
