+++
title = "Create Cortex or Loki managed alert rule"
description = "Create Cortex or Loki managed alerting rule"
keywords = ["grafana", "alerting", "guide", "rules", "create"]
weight = 400
+++

# Create a Cortex or Loki managed alerting rule

Grafana allows you manage alerting rules for an external Cortex or Loki instance. 

## Add or edit a Cortex or Loki managed alerting rule

1. In the Grafana menu hover your cursor over the Alerting (bell) icon.
1. To create a new alert rule, click **New alert rule**. To edit an existing rule, expand one of the rules in the **Cortex / Loki** section and click **Edit**.
1. Click on the **Alert type** drop down and select **Cortex / Loki managed alert**.
1. Fill out the rest of the fields. Descriptions are listed below in [Alert rule fields](#alert-rule-fields).
1. When you have finished writing your rule, click **Save** in the upper right corner to save the rule,, or **Save and exit** to save and exit rule editing.

## Alert rule fields

This section describes the fields you fill out to create an alert.

### Alert type

  - **Alert name -** Enter a descriptive name. The name will be displayed in the alert rule list, as well as added as `alertname` label to every alert instance that is created from this rule.
  - **Alert type -** Select **Cortex / Loki managed alert**.
  - **Data source -** Select a Prometheus or Loki data source. Only Prometheus data sources that support Cortex ruler API will be available. 
  - **Namespace -** Select an existing rule namespace or click **Add new** to create a new one.
  - **Group -** Select an existing group within the selected namespace or click **Add new** to create a new one. Newly created rules will be added to the end of the rule group.

![Alert type section screenshot](/static/img/docs/alerting/unified/rule-edit-cortex-alert-type-8-0.png 'Alert type section screenshot')

### Query

Enter a PromQL or LogQL expression. Rule will fire if evaluation result has at least one series with value > 0. An alert will be created per each such series.

![Query section](/static/img/docs/alerting/unified/rule-edit-cortex-query-8-0.png 'Query section screenshot')

### Conditions

  - **For -** For how long the selected condition should violated before an alert enters `Firing` state. When condition threshold is violated for the first time, an alert becomes `Pending`. If the **for** time elapses and the condition is still violated, it becomes `Firing`. Else it reverts back to `Normal`. 

![Conditions section](/static/img/docs/alerting/unified/rule-edit-cortex-conditions-8-0.png 'Conditions section screenshot')

### Details

Annotations and labels can be optionally added in the details section.

#### Annotations

Annotations are key and value pairs that provide additional meta information about the alert, for example description, summary, runbook URL. They are displayed in rule and alert details in the UI and can be used in contact type message templates. Annotations can also be templated, for example `Instance {{ $labels.instance }} down` will have the evaluated `instance` label value added for every alert this rule produces. 

#### Labels

Labels are key value pairs that categorize or identify an alert. Labels are  used to match alerts in silences or match and groups alerts in notification policies. Labels are also shown in rule or alert details in the UI and can be used in contact type message templates. For example, it is common to add a `severity` label and then configure a separate notification policy for each severity. Or one could add a `team` label and configure team specific notification policies, or silence all alerts for a particular team.

![Details section](/static/img/docs/alerting/unified/rule-edit-details-8-0.png 'Details section screenshot')

## Preview alerts

To evaluate the rule and see what alerts it would produce, click **Preview alerts**. It will display a list of alerts with state and value of for each one.