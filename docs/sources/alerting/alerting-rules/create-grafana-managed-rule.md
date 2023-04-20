---
aliases:
  - ../unified-alerting/alerting-rules/create-grafana-managed-rule/
description: Create Grafana managed alert rule
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - create
title: Create Grafana-managed alert rules
weight: 400
---

# Create Grafana-managed alert rules

Grafana-managed rules are the most flexible alert rule type. They allow you to create alerts that can act on data from any of our supported data sources. In addition to supporting multiple data sources, you can also add expressions to transform your data and set alert conditions. Using images in alert notifications is also supported. This is the only type of rule that allows alerting from multiple data sources in a single rule definition.

Multiple alert instances can be created as a result of one alert rule (also known as a multi-dimensional alerting).

For information on Grafana Alerting, see [Introduction to Grafana Alerting](/docs/grafana/next/alerting/fundamentals/), which explains the key concepts and features of Grafana Alerting.

Watch this video to learn more about creating alerts: {{< vimeo 720001934 >}}

_Video shows Alerting in Grafana v9.0. Refer to [Add Grafana managed rule]({{< relref "#add-grafana-managed-rule" >}}) (following) for current instructions._

To create a Grafana-managed alert rule, complete the following steps.

1. In the left-side menu, click **Alerts & IRM** and then **Alerting**.
2. Click **Alert rules**.
3. Click **+ Create alert rule**. The new alert rule page opens where the **Grafana managed alerts** option is selected by default.
4. In Step 1, add the rule name.
   - In **Rule name**, add a descriptive name. This name is displayed in the alert rule list. It is also the `alertname` label for every alert instance that is created from this rule.
5. In Step 2, add queries and expressions to evaluate, and then select the alert condition.

   - For queries, select a data source from the dropdown.
   - Specify a [time range](/docs/grafana/latest/dashboards/use-dashboards/?pg=blog&plcmt=body-txt#time-units-and-relative-ranges).

     **Note:**
     Grafana Alerting only supports fixed relative time ranges, for example, `now-24hr: now`.

     It does not support absolute time ranges: `2021-12-02 00:00:00 to 2021-12-05 23:59:592` or semi-relative time ranges: `now/d to: now`.

   - Add one or more [queries]({{< relref "/docs/grafana/latest/panels-visualizations/query-transform-data#add-a-query" >}}) or [expressions]({{< relref "/docs/grafana/latest/panels-visualizations/query-transform-data/expression-queries" >}}).
   - For each expression, select either **Classic condition** to create a single alert rule, or choose from the **Math**, **Reduce**, and **Resample** options to generate separate alert for each series. For details on these options, see [Single and multi dimensional rule](#single-and-multi-dimensional-rule).
   - Click **Run queries** to verify that the query is successful.
   - Next, select the query or expression for your alert condition.

6. In Step 3, specify the alert evaluation interval.

   - From the **Condition** dropdown, select the query or expression to trigger the alert rule.
   - For **Evaluate every**, specify the frequency of evaluation. Must be a multiple of 10 seconds. For examples, `1m`, `30s`.
   - For **Evaluate for**, specify the duration for which the condition must be true before an alert fires.
     > **Note:** Once a condition is breached, the alert goes into the Pending state. If the condition remains breached for the duration specified, the alert transitions to the `Firing` state, otherwise it reverts back to the `Normal` state.
   - In **Configure no data and error handling**, configure alerting behavior in the absence of data. Use the guidelines in [No data and error handling](#no-data-and-error-handling).
   - Click **Preview** to check the result of running the query at this moment. Preview excludes no data and error handling.

     **Note:**

     You can pause alert rule evaluation to prevent noisy alerting while tuning your alerts. Pausing stops alert rule evaluation and does not create any alert instances. This is different to mute timings, which stop notifications from being delivered, but still allow for alert rule evaluation and the creation of alert instances.

7. In Step 4, add the storage location, rule group, as well as additional metadata associated with the rule.
   - From the **Folder** dropdown, select the folder where you want to store the rule.
   - For **Group**, specify a pre-defined group. Newly created rules are appended to the end of the group. Rules within a group are run sequentially at a regular interval, with the same evaluation time.
   - Add a description and summary to customize alert messages. Use the guidelines in [Annotations and labels for alerting]({{< relref "../fundamentals/annotation-label/" >}}).
   - Add Runbook URL, panel, dashboard, and alert IDs.
8. In Step 5, add custom labels.
   - Add custom labels selecting existing key-value pairs from the drop down, or add new labels by entering the new key or value .
9. Click **Save** to save the rule or **Save and exit** to save the rule and go back to the Alerting page.
10. Next, create a for the rule.

### Single and multi-dimensional rule

For Grafana managed alerts, you can create a rule with a classic condition or you can create a multi-dimensional rule.

**Rule with classic condition**

Use the classic condition expression to create a rule that triggers a single alert when its condition is met. For a query that returns multiple series, Grafana does not track the alert state of each series. As a result, Grafana sends only a single alert even when alert conditions are met for multiple series.

For more information, see [expressions documentation]({{< relref "/docs/grafana/latest/panels-visualizations/query-transform-data/expression-queries" >}}).

**Multi-dimensional rule**

To generate a separate alert for each series, create a multi-dimensional rule. Use `Math`, `Reduce`, or `Resample` expressions to create a multi-dimensional rule. For example:

- Add a `Reduce` expression for each query to aggregate values in the selected time range into a single value. (Not needed for [rules using numeric data]({{< relref "../fundamentals/evaluate-grafana-alerts/#alerting-on-numeric-data-1" >}})).
- Add a `Math` expression with the condition for the rule. Not needed in case a query or a reduce expression already returns 0 if rule should not fire, or a positive number if it should fire. Some examples: `$B > 70` if it should fire in case value of B query/expression is more than 70. `$B < $C * 100` in case it should fire if value of B is less than value of C multiplied by 100. If queries being compared have multiple series in their results, series from different queries are matched if they have the same labels or one is a subset of the other.

![Query section multi dimensional](/static/img/docs/alerting/unified/rule-edit-multi-8-0.png 'Query section multi dimensional screenshot')

> **Note:** Grafana does not support alert queries with template variables. More information is available at <https://community.grafana.com/t/template-variables-are-not-supported-in-alert-queries-while-setting-up-alert/2514>.

### Configure no data and error handling

Configure alerting behavior when your alert rule evaluation returns no data or an error.

**Note:** Alert rules that are configured to fire when an evaluation returns no data or error only fire when the entire duration of the evaluation period has finished. This means that rather than immediately firing when the alert rule condition is breached, the alert rule waits until the time set as the **For** field has finished and then fires, reducing alert noise and allowing for temporary data availability issues.

If your alert rule evaluation returns no data, you can set the state on your alert rule to appear as follows:

| No Data  | Description                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| No Data  | Creates a new alert `DatasourceNoData` with the name and UID of the alert rule, and UID of the datasource that returned no data as labels. |
| Alerting | Sets alert rule state to `Alerting`. The alert rule waits until the time set in the **For** field has finished before firing.              |
| Ok       | Sets alert rule state to `Normal`.                                                                                                         |

If your evaluation returns an error, you can set the state on your alert rule to appear as follows:

| Error    | Description                                                                                                                                     |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Error    | Creates an alert instance `DatasourceError` with the name and UID of the alert rule, and UID of the datasource that returned no data as labels. |
| Alerting | Sets alert rule state to `Alerting`. The alert rule waits until the time set in the **For** field has finished before firing.                   |
| Ok       | Sets alert rule state to `Normal`.                                                                                                              |
