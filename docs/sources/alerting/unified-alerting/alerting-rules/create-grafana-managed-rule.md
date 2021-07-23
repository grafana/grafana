+++
title = "Create Grafana managed alert rule"
description = "Create Grafana managed alert rule"
keywords = ["grafana", "alerting", "guide", "rules", "create"]
weight = 400
+++

# Create a Grafana managed alerting rule

Grafana allows you to create alerting rules that query one or more data sources, reduce or transform the results and compare them to each other or to fix thresholds. These rules will be executed and notifications sent by Grafana itself. 

## Add or edit a Grafana managed alerting rule

1. In the Grafana menu hover your cursor over the Alerting (bell) icon.
1. To create a new alert rule, click **New alert rule**. To edit an existing rule, expand one of the rules in the **Grafana** section and click **Edit**.
1. Click on the **Alert type** drop down and select **Grafana managed alert**.
1. Fill out the rest of the fields. Descriptions are listed below in [Alert rule fields](#alert-rule-fields).
1. When you have finished writing your rule, click **Save** in the upper right corner to save the rule,, or **Save and exit** to save and exit rule editing.

## Alert rule fields

This section describes the fields you fill out to create an alert.

### Alert type

  - **Alert name -** Enter a descriptive name. The name will be displayed in the alert rule list, as well as added as `alertname` label to every alert instance that is created from this rule.
  - **Alert type -** Select **Grafana managed alert**.
  - **Folder -** Select a folder this alert rule will belong to. To create a new folder, click on the drop down and type in a new folder name.

![Alert type section screenshot](/static/img/docs/alerting/unified/rule-edit-grafana-alert-type-8-0.png 'Alert type section screenshot')

### Query

Add one or more [queries]({{< relref "../../../panels/queries.md" >}}) or [expressions]({{< relref "../../../panels/expressions.md" >}}). You can use classic condition expression to create a rule that will trigger a single alert if it's threshold is met, or use reduce and math expressions to create a multi dimensional alert rule that can trigger multiple alerts, one per matching series in the query result. 

#### Rule with classic condition

You can use classic condition expression to create a rule that will trigger a single alert if it's conditions is met. It works about the same way as dashboard alerts in previous versions of Grafana.

1. Add one or more queries
1. Add an expression. Click on **Operation** dropdown and select **Classic condition**.
1. Add one or more conditions. For each condition you can specify operator (`AND` / `OR`), aggregation function, query letter and threshold value.

If a query returns multiple series, then the aggregation function and threshold check will be evaluated for each series.It will not track alert state **per series**. This has implications that are detailed in the scenario below. 

- Alert condition with query that returns 2 series: **server1** and **server2**
- **server1** series causes the alert rule to fire and switch to state `Firing`
- Notifications are sent out with message: _load peaking (server1)_
- In a subsequent evaluation of the same alert rule, the **server2** series also causes the alert rule to fire
- No new notifications are sent as the alert rule is already in state `Firing`.

So, as you can see from the above scenario Grafana will not send out notifications when other series cause the alert to fire if the rule already is in state `Firing`. If you want to have alert per series, create a multi dimensional alert rule as described in the section below.

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

| No Data Option  | Description                                                                                |
| --------------- | ------------------------------------------------------------------------------------------ |
| No Data         | Set alert state to `NoData` and rule state to `Normal`                                     |
| Alerting        | Set alert rule state to `Alerting`                                                         |
| Ok              | Set alert rule state to `Normal`                                                           |


| Error or timeout option | Description                                         |
| ----------------------- | --------------------------------------------------- |
| Alerting                | Set alert rule state to `Alerting`                  |
| OK                      | Set alert rule state to `Normal`                    |

![Conditions section](/static/img/docs/alerting/unified/rule-edit-grafana-conditions-8-0.png 'Conditions section screenshot')

### Details

Annotations and labels can be optionally added in the details section.

#### Annotations

Annotations are key and value pairs that provide additional meta information about the alert, for example description, summary, runbook URL. They are displayed in rule and alert details in the UI and can be used in contact type message templates. Annotations can also be templated, for example `Instance {{ $labels.instance }} down` will have the evaluated `instance` label value added for every alert this rule produces. 

#### Labels

Labels are key value pairs that categorize or identify an alert. Labels are  used to match alerts in silences or match and groups alerts in notification policies. Labels are also shown in rule or alert details in the UI and can be used in contact type message templates. For example, it is common to add a `severity` label and then configure a separate notification policy for each severity. Or one could add a `team` label and configure team specific notification policies, or silence all alerts for a particular team. Labels can also be templated like annotations, for example `{{ $labels.namespace }}/{{ $labels.job }}` will produce a new rule label that will have the evaluated `namespace` and `job` label value added for every alert this rule produces. The rule labels take precedence over the labels produced by the query/condition.

![Details section](/static/img/docs/alerting/unified/rule-edit-details-8-0.png 'Details section screenshot')

#### Template variables

The following template variables are available when expanding annotations and labels.

| Name    | Description     |
| ------- | --------------- |
| $labels | The labels from the query or condition. For example, `{{ $labels.instance }}` and `{{ $labels.job }}`. |
| $values | The values of all reduce and math expressions that were evaluated for this alert rule. For example, `{{ $values.A }}`, `{{ $values.A.Labels }}` and `{{ $values.A.Value }}` where `A` is the `refID` of the expression. |
| $value  | The value string of the alert instance. For example, `[ var='A' labels={instance=foo} value=10 ]`. |

## Preview alerts

To evaluate the rule and see what alerts it would produce, click **Preview alerts**. It will display a list of alerts with state and value for each one.
