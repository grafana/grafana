+++
title = "Create Grafana managed alert rule"
description = "Create Grafana managed alert rule"
keywords = ["grafana", "alerting", "guide", "rules", "create"]
weight = 400
+++

# Create a Grafana managed alerting rule

Grafana allows you to create alerting rules that query one or more data sources, reduce or transform the results and compare them to each other or to fix thresholds. When these are executed, Grafana sends notifications to the contact point.

For Grafana managed alerts, you can create a rule with a classic condition or you can create a multi-dimensional rule.

**Rule with classic condition**

Use the classic condition expression to create a rule that triggers a single alert when its condition is met. If a query returns multiple series, then the aggregation function and threshold check is evaluated for each series. However, the alert state in not tracked for each series. As a result, Grafana only sends out a single alert even when alerts conditions are met for multiple series. 

**Multi dimensional rule**

To get separate alert alerts for each series, create a multi-dimensional rule. Use `math` and `reduce` expressions to create a multi-dimensional rule. For more information, see [expressions documentation]({{< relref "../../../panels/expressions.md" >}}).

1. Add one or more queries
2. Add a `reduce` expression for each query to aggregate values in the selected time range into a single value. With some data sources this is not needed for [rules using numeric data]({{< relref "../grafana-managed-numeric-rule.md" >}}).
3. Add a `math` expressions with the condition for the rule. Not needed in case a query or a reduce expression already returns 0 if rule should not be firing, or > 0 if it should be firing. Some examples: `$B > 70` if it should fire in case value of B query/expression is more than 70. `$B < $C * 100` in case it should fire if value of B is less than value of C multiplied by 100. If queries being compared have multiple series in their results, series from different queries are matched if they have the same labels or one is a subset of the other.

See or [expressions documentation]({{< relref "../../../panels/expressions.md" >}}) for in depth explanation of `math` and `reduce` expressions.

![Query section multi dimensional](/static/img/docs/alerting/unified/rule-edit-multi-8-0.png 'Query section multi dimensional screenshot')



## Add a Grafana managed alerting rule

1. In the Grafana menu hover your cursor over the Alerting (bell) icon. The Alerting page opens listing existing alerts.
1. Click **New alert rule**. 
1. Add the rule name, type and storage location in Step 1:
    - In **Rule name**, add a descriptive name. This name is displayed in the alert rule list. It also gets added as `alertname` label to every alert instance that is created from this rule.
    - From the **Rule type** drop down, select **Grafana managed alert**.
    - From the **Folder** drop-down, select the folder where you want to store the rule. If you do not select a folder, the rule is stored in the General folder. To create a new folder, click the drop down and enter the new folder name.
1. Add a query and/or expression along with in Step 2:
    - Hover over the default query name, and edit it by clicking on the edit icon.
    - Select a data source from the drop-down.
    - Add one or more [queries]({{< relref "../../../panels/queries.md" >}}) or [expressions]({{< relref "../../../panels/expressions.md" >}}). 
    - For each expression, either select the **Classic condition** or choose from **Mean**, **Reduce**, **Resample** options. (For details on these options, review the introduction section).
1. Click **Run queries** to  

Fill out the rest of the fields. Descriptions are listed below in [Alert rule fields](#alert-rule-fields).
1. When you have finished writing your rule, click **Save** in the upper right corner to save the rule,, or **Save and exit** to save and exit rule editing.


### Query

Add one or more [queries]({{< relref "../../../panels/queries.md" >}}) or [expressions]({{< relref "../../../panels/expressions.md" >}}). You can use classic condition expression to create a rule that will trigger a single alert if it's threshold is met, or use reduce and math expressions to create a multi dimensional alert rule that can trigger multiple alerts, one per matching series in the query result.


![Query section classic condition](/static/img/docs/alerting/unified/rule-edit-classic-8-0.png 'Query section classic condition screenshot')

#### Multi dimensional rule

You can use reduce and math expressions to create a rule that will create an alert per series returned by the query.

1. Add one or more queries
2. Add a `reduce` expression for each query to aggregate values in the selected time range into a single value. With some data sources this is not needed for [rules using numeric data]({{< relref "../grafana-managed-numeric-rule.md" >}}).
3. Add a `math` expressions with the condition for the rule. Not needed in case a query or a reduce expression already returns 0 if rule should not be firing, or > 0 if it should be firing. Some examples: `$B > 70` if it should fire in case value of B query/expression is more than 70. `$B < $C * 100` in case it should fire if value of B is less than value of C multiplied by 100. If queries being compared have multiple series in their results, series from different queries are matched if they have the same labels or one is a subset of the other.

See or [expressions documentation]({{< relref "../../../panels/expressions.md" >}}) for in depth explanation of `math` and `reduce` expressions.

![Query section multi dimensional](/static/img/docs/alerting/unified/rule-edit-multi-8-0.png 'Query section multi dimensional screenshot')

### Conditions

- **Condition -** Select the letter of the query or expression whose result will trigger the alert rule. You will likely want to select either a `classic condition` or a `math` expression.
- **Evaluate every -** How often the rule should be evaluated, executing the defined queries and expressions. Must be no less than 10 seconds and a multiple of 10 seconds. Examples: `1m`, `30s`
- **Evaluate for -** For how long the selected condition should violated before an alert enters `Alerting` state. When condition threshold is violated for the first time, an alert becomes `Pending`. If the **for** time elapses and the condition is still violated, it becomes `Alerting`. Else it reverts back to `Normal`.

#### No Data & Error handling

Toggle **Configure no data and error handling** switch to configure how the rule should handle cases where evaluation results in error or returns no data.

| No Data Option | Description                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| No Data        | Set alert state to `NoData` and rule state to `Normal` (notifications are not sent on NoData states). |
| Alerting       | Set alert rule state to `Alerting`.                                                                   |
| Ok             | Set alert rule state to `Normal`.                                                                     |

| Error or timeout option | Description                        |
| ----------------------- | ---------------------------------- |
| Alerting                | Set alert rule state to `Alerting` |
| OK                      | Set alert rule state to `Normal`   |

![Conditions section](/static/img/docs/alerting/unified/rule-edit-grafana-conditions-8-0.png 'Conditions section screenshot')

### Details

Annotations and labels can be optionally added in the details section.

#### Annotations

Annotations are key and value pairs that provide additional meta information about the alert, for example description, summary, runbook URL. They are displayed in rule and alert details in the UI and can be used in contact type message templates. Annotations can also be templated, for example `Instance {{ $labels.instance }} down` will have the evaluated `instance` label value added for every alert this rule produces.

