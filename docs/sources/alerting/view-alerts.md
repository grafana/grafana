+++
title = "View alert rules"
description = "View existing alert rules"
keywords = ["grafana", "alerting", "guide", "rules", "view"]
weight = 400
+++

# View alert rules


In the Grafana side bar, hover your cursor over the Alerting (bell) icon and then click **Alert Rules**. By default it will list all configured Grafana alert rules as well as any rules from Loki or Prometheus data sources. By default the group view is shown. You can toggle between group or state views by clicking relevant **View as** buttons in the options area the top of the page.

## Group view

![Grouped alert rule view](/img/docs/alerting/unified/rule-list-group-view-8-0.png 'Screenshot of grouped alert rule view')


Group view shows Grafana alert rules grouped by folder and Loki or Prometheus alert rules grouped by namespace + group. This is the default rule list view, intended to be used for managing rules. You can expand each group to view a list of rules in this group. Each rule can be expanded to view it's details, action buttons and any alerts spawned by this rule, and each alert can be further expanded to view it's details.

## State view

![Alert rule state view](/img/docs/alerting/unified/rule-list-state-view-8-0.png 'Screenshot of alert rule state view')

State view shows alert rules grouped by state. Use this view to get an overview of which rules are in what state. Each rule can be expanded to view it's details, action buttons and any alerts spawned by this rule, and each alert can be further expanded to view it's details.

## Filter alert rules
You can use filter controls to view only alert rules that match specific criteria:

- **Filter alerts by name or label -** Type an alert name, label name or value in the **Search** input.
- **Filter alerts by state -** In **States**, select which alert states you want to see. All others will be hidden.
- **Filter alerts by datasource -** Click the **Select datasource** and select an alerting datasource. Only alert rules that query selected datasource will be visible.

## Rule details

![Alert rule details](/img/docs/alerting/unified/rule-details-8-0.png 'Screenshot of alert rule details')

A rule row will show rule state, health and summary annotation the rule has one. Rule row can be expanded to reveal rule labels, all annotations, datasources this rule queries and list of alerts spawned from this rule.

### Rule state

Rule state can be one of the following:
- **Normal -** rule evaluation result is negative and it is not firing.
- **Pending -** rule evaluation result is positive and it will become firing after **for** period passes.
- **Firing -** rule evaluation result is positive and it is spawning alerts. 

### Rule health

Rule health can be one of the following:

- **ok -** rule is being successfully evaluated.
- **nodata -** rule is being evaluated, but no data is is returned. Depending on rule configuration this can result in either **Normal** or **Firing** state.
- **error -** attempting to evaluate the rule has resulted in error. Hover mouse over the **error** label to see error details in a popover.

### Matching instances

Matching instance are the alerts spawned by evaluating this rule. In case of grafana rules that use classic conditions there will be just one. In case of multi dimensional Grafana rules, Prometheus or Loki rules there can be several. Labels for an alert instance consist of rule labels, labels that come from evaluation result as well as the **alertname** label that matches the name of the rule.  


### Edit or delete rule

To edit or delete a rule, expand this rule to reveal rule controls. Click "Edit" button to go to [rule editing form]({{< relref "create-alerts.md" >}}). Click "Delete" button to delete a rule. Grafana rules can only be edited or deleted by users with Edit permissions for the folder which contains the rule. Prometheus or Loki rules can be edited or deleted by user with Editor or Admin role. 