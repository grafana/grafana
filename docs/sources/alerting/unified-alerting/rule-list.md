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

Group view shows Grafana alert rules grouped by folder and Loki or Prometheus alert rules grouped by `namespace` + `group`. This is the default rule list view, intended for managing rules. You can expand each group to view a list of rules in this group. Each rule can be further expanded to view its details. Action buttons and any alerts spawned by this rule, and each alert can be further expanded to view its details.

![Grouped alert rule view](/img/docs/alerting/unified/rule-list-group-view-8-0.png 'Screenshot of grouped alert rule view')

### State view

State view shows alert rules grouped by state. Use this view to get an overview of which rules are in what state. Each rule can be expanded to view its details. Action buttons and any alerts spawned by this rule, and each alert can be further expanded to view its details.

![Alert rule state view](/img/docs/alerting/unified/rule-list-state-view-8-0.png 'Screenshot of alert rule state view')

## Filter alert rules
You can use the following filters to view only alert rules that match specific criteria:

- **Filter alerts by name or label -** Type an alert name, label name or value in the **Search** input.
- **Filter alerts by state -** In **States** Select which alert states you want to see. All others are hidden.
- **Filter alerts by data source -** Click the **Select data source** and select an alerting data source. Only alert rules that query selected data source will be visible.

## Rule details

A rule row shows the rule state, health, and summary annotation if the rule has one. You can expand the rule row to display rule labels, all annotations, data sources this rule queries, and a list of alert instances spawned from this rule.

![Alert rule details](/img/docs/alerting/unified/rule-details-8-0.png 'Screenshot of alert rule details')

### Edit or delete rule


Grafana rules can only be edited or deleted by users with Edit permissions for the folder which contains the rule. Prometheus or Loki rules can be edited or deleted by users with Editor or Admin roles. 

To edit or delete a rule:

1. Expand this rule to reveal rule controls. 
1. Click **Edit** to go to the rule editing form. Make changes following [instructions listed here]({{< relref "./create-alert-rule.md" >}}).
1. Click **Delete"** to delete a rule. 
