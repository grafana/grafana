+++
title = "View alert rules"
description = "View alert rules"
keywords = ["grafana", "alerting", "guide", "rules", "view"]
weight = 400
+++

# View alert rules

To view alters:
1. In the Grafana menu hover your cursor over the Alerting (bell) icon.
1. Click **Alert Rules**. You can see all configured Grafana alert rules as well as any rules from Loki or Prometheus data sources. 
By default, the group view is shown. You can toggle between group or state views by clicking the relevant **View as** buttons in the options area at the top of the page.

### Group view

![Grouped alert rule view](/img/docs/alerting/unified/rule-list-group-view-8-0.png 'Screenshot of grouped alert rule view')


Group view shows Grafana alert rules grouped by folder and Loki or Prometheus alert rules grouped by `namespace` + `group`. This is the default rule list view, intended for managing rules. You can expand each group to view a list of rules in this group. Each rule can be further expanded to view its details. Action buttons and any alerts spawned by this rule, and each alert can be further expanded to view its details.

### State view

![Alert rule state view](/img/docs/alerting/unified/rule-list-state-view-8-0.png 'Screenshot of alert rule state view')

State view shows alert rules grouped by state. Use this view to get an overview of which rules are in what state. Each rule can be expanded to view its details. Action buttons and any alerts spawned by this rule, and each alert can be further expanded to view its details.

## Filter alert rules
You can use the following filters to view only alert rules that match specific criteria:

- **Filter alerts by name or label -** Type an alert name, label name or value in the **Search** input.
- **Filter alerts by state -** In **States** Select which alert states you want to see. All others are hidden.
- **Filter alerts by datasource -** Click the **Select datasource** and select an alerting datasource. Only alert rules that query selected datasource will be visible.

## Rule details

![Alert rule details](/img/docs/alerting/unified/rule-details-8-0.png 'Screenshot of alert rule details')

A rule row shows the rule state, health, and summary annotation if the rule has one. You can expand the rule row to display rule labels, all annotations, data sources this rule queries, and a list of alerts spawned from this rule.

### Rule state

Rule state can be one of the following:
- **Normal:** Eule evaluation result is negative and it is not firing.
- **Pending:** Rule evaluation result is positive and it will fire after the **for** period passes.
- **Firing:** Rule evaluation result is positive and it is spawning alerts. 

### Rule health

Rule health can be one of the following:

- **ok:** Rule is being successfully evaluated.
- **nodata:** Rule is being evaluated but no data is is returned. Depending on the rule configuration, this can result in either **Normal** or **Firing** state.
- **error:** Attempting to evaluate the rule has resulted in an error. Hover mouse over the **error** label to see the error details.

### Matching instances

Matching instance are the alerts spawned by evaluating this rule. In case of grafana rules that use classic conditions there will be just one. In case of multi dimensional Grafana rules, Prometheus or Loki rules there can be several. Labels for an alert instance consist of rule labels, labels that come from evaluation result as well as the **alertname** label that matches the name of the rule.  


### Edit or delete rule


Grafana rules can only be edited or deleted by users with Edit permissions for the folder which contains the rule. Prometheus or Loki rules can be edited or deleted by users with Editor or Admin roles. 

To edit or delete a rule:

1. Expand this rule to reveal rule controls. 
1. Click **Edit** to go to the rule editing form. Make changes using instruction in ??
1. Click **Delete"** to delete a rule. 
