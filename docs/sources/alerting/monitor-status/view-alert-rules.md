---
aliases:
  - ../../alerting/unified-alerting/alerting-rules/rule-list/ # /docs/grafana/<GRAFANA_VERSION>/alerting/unified-alerting/alerting-rules/rule-list
  - ../../alerting/alerting-rules/view-alert-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/view-alert-rules
  - ../../alerting/alerting-rules/rule-list/ # /docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/rule-list
  - ../../alerting/manage-notifications/view-alert-rules/ # /docs/grafana/<GRAFANA_VERSION>/alerting/manage-notifications/view-alert-rules/
canonical: https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-rules/
description: View and filter alert rules and recording rules, compare rule versions, and restore deleted rules.
keywords:
  - grafana
  - alerting
  - guide
  - rules
  - view
labels:
  products:
    - cloud
    - enterprise
    - oss
title: View alert rules
weight: 410
---

# View alert rules

Grafana Alerting lists Grafana-managed alert rules and recording rules on separate pages:

- **Alert rules**: Lists your alert rules with their current state.
- **Recording rules**: Lists your recording rules with the metric each one records.

To open either page, click **Alerts & IRM** -> **Alerting**, and then click **Alert rules** or **Recording rules**.

Both pages work the same way. You can browse rules by folder or as a single list, search and filter them, and run actions on individual rules.

Each rule shows the following details:

- **State**: The icon next to the rule name shows the rule state, such as **Firing**, **Pending**, **Recovering**, **Normal**, or **Paused**. Recording rules show **Recording**.
- **Name**: Click the rule name to open the rule details page.
- **Summary or error**: The rule's summary annotation, or the last evaluation error if the rule failed to evaluate.
- **Alert instances**: The number of alert instances in each state. Click the counts to open the **Instances** tab of the rule. Alert rules only.
- **Recorded metric**: The metric the rule records and the data source it writes to. Recording rules only.
- **Folder**: The folder that contains the rule.
- **Labels and data sources**: The number of labels on the rule and the data sources it queries.
- **Notifications**: The contact point or notification policy that handles the rule's notifications. Alert rules only.
- **Evaluation**: How often the rule is evaluated. If the rule belongs to a [rule sequence](/docs/grafana/<GRAFANA_VERSION>/alerting/alerting-rules/rule-sequences/), click **Rule sequence** to view the rules in the sequence.

Rules that are provisioned or created by a plugin show a badge next to their name.

These pages don't list alert rules that are stored in a data source such as Mimir or Loki. For those rules, refer to [Legacy data source-managed alerts](/docs/grafana/<GRAFANA_VERSION>/alerting/set-up/data-source-managed-alerts/).

For details on how rule states and alert instance states are displayed, refer to [View alert state](/docs/grafana/<GRAFANA_VERSION>/alerting/monitor-status/view-alert-state/).

## Change the rule list view

Use the **View** option next to the search input to change how the rules are displayed.

- **Folders**: Lists the folders that contain rules, with the number of rules directly in each folder. Expand a folder to view its rules. Subfolders are listed separately. This is the default view.
- **List**: Displays all rules in a single list. Click **Load more** at the end of the list to load more rules.

The **Folders** view is only available when you browse or filter by folder. When you apply any other filter or search by name, the page switches to the **List** view. To return to the **Folders** view, clear the filters.

{{< figure src="/media/docs/alerting/view-alert-rule-list-with-actions-2.png" max-width="750px" alt="View alert rule state and alert rule health in Grafana Alerting" >}}

## Filter and save searches

Use the **Filters** sidebar or the search input to find rules. The sidebar and the search input are kept in sync, so changes made in either place are reflected in the other.

The following filters are available on both pages:

- **Rule name**: Matches text in the rule name.
- **Labels**: Matches rules by their labels. Click **Add label** to add a label matcher.
- **Folder**: Matches rules that are directly in the selected folders.
- **Query data source**: Matches rules that query the selected data sources.
- **Health**: Matches rules by their health: **OK**, **No data**, **Error**, or **Unknown**.
- **Paused**: Matches only paused rules.
- **Plugin rules**: Shows or hides rules created by plugins.

The **Alert rules** page has the following additional filters:

- **Alert state**: Matches rules by their state: **Firing**, **Pending**, **Recovering**, or **Normal**.
- **Contact point**: Matches rules that send notifications directly to the selected contact point.
- **Notification policy**: Matches rules that are routed through the selected notification policy tree.
- **Dashboard** and **Panel ID**: Match rules that are linked to a dashboard or to one of its panels.

The **Recording rules** page has the following additional filters:

- **Recorded metric**: Matches rules that record the metric with this exact name.
- **Target data source**: Matches rules that write the recorded metric to the selected data source.

### Save a search

Click **Saved searches** to open the list of previously saved searches, or click **Save current search** to add your current search to the list. You can also rename or delete a saved search, or set it as the default search. When you set a saved search as the default search, the page opens with the search applied.

The **Alert rules** and **Recording rules** pages each have their own saved searches.

{{< figure src="/media/docs/alerting/alerting-saved-searches.png" max-width="750px" alt="Alert rule filter options" >}}

### Search syntax

The search input accepts a structured `key:value` syntax. The key on the left of the colon is the filter type, and the value on the right is what you want to match. Don't add a space after the colon. Use quotation marks around values that contain spaces, for example `folder:"Team 01"`.

Any text entered without a `key:` prefix filters rules by name. A word that starts with a key the page doesn't support is also treated as part of the name.

The following filter types are supported on both pages:

| Filter type  | Description                                                             | Example             |
| ------------ | ----------------------------------------------------------------------- | ------------------- |
| `rule`       | Text in the rule name. This is the same as entering text without a key. | `rule:cpu-high`     |
| `label`      | A [label matcher](#match-labels).                                       | `label:team=api`    |
| `folder`     | A folder name or part of it. Matching ignores case.                     | `folder:Alerts`     |
| `folderUid`  | The UID of a folder.                                                    | `folderUid:abc123`  |
| `datasource` | The UID of a data source that the rule queries.                         | `datasource:abc123` |
| `health`     | The rule health: `ok`, `nodata`, `error`, or `unknown`.                 | `health:error`      |
| `paused`     | `paused:true` shows only paused rules.                                  | `paused:true`       |
| `plugins`    | `plugins:hide` excludes rules created by plugins.                       | `plugins:hide`      |

The following filter types are supported only on the **Alert rules** page:

| Filter type    | Description                                                                       | Example                |
| -------------- | --------------------------------------------------------------------------------- | ---------------------- |
| `state`        | The alert rule state: `firing`, `pending`, `recovering`, or `normal`.             | `state:firing`         |
| `contactPoint` | The contact point that the rule sends notifications to directly.                  | `contactPoint:on-call` |
| `policy`       | The notification policy tree that the rule is routed through.                     | `policy:team-platform` |
| `dashboard`    | The UID of the dashboard that the rule is linked to.                              | `dashboard:abc123`     |
| `panelId`      | The ID of the panel that the rule is linked to. Use it together with `dashboard`. | `panelId:4`            |

The following filter types are supported only on the **Recording rules** page:

| Filter type        | Description                                                        | Example                   |
| ------------------ | ------------------------------------------------------------------ | ------------------------- |
| `metric`           | The exact name of the recorded metric.                             | `metric:cpu_usage`        |
| `targetDatasource` | The UID of the data source that the recorded metric is written to. | `targetDatasource:abc123` |

You can combine multiple filters in a single search. The following rules apply:

- You can repeat the `folderUid`, `datasource`, and `label` filters. Repeated `folderUid` and `datasource` filters match rules in any of the folders or data sources. A rule must satisfy every `label` filter.
- If you repeat any other filter, the search uses the last value.
- You can't combine `contactPoint` and `policy`, because a rule either sends notifications directly to a contact point or is routed through a notification policy.
- The `state`, `health`, and `paused` values ignore case. Filter types are case-sensitive.

The search help next to the search input lists the filter types available on the page.

#### Match labels

The `label` filter accepts Prometheus-style matchers, so you can match rules by label name, by exact label value, or by regular expression. The other filter types don't support regular expressions.

The following matchers are supported:

| Matcher                | Matches rules where                                   |
| ---------------------- | ----------------------------------------------------- |
| `label:<KEY>`          | The label exists.                                     |
| `label:!<KEY>`         | The label doesn't exist.                              |
| `label:<KEY>=<VALUE>`  | The label value is exactly equal to the value.        |
| `label:<KEY>!=<VALUE>` | The label value isn't equal to the value.             |
| `label:<KEY>=~<REGEX>` | The label value matches the regular expression.       |
| `label:<KEY>!~<REGEX>` | The label value doesn't match the regular expression. |

For example:

- `label:severity` matches rules that have a `severity` label.
- `label:severity=~crit.*` matches rules where the `severity` label matches the regular expression, such as `critical` or `crit-high`.
- `label:team!~fe.*` matches rules where the `team` label doesn't start with `fe`.

Use quotation marks when the value contains spaces, for example `label:team="a b"`.

Regular expressions are fully anchored, so the pattern must match the entire label value. Use `.*` or `.+` to match part of a value, for example `label:severity=~.*crit.*`.

Label matchers apply to the labels defined on the rule.

## Manage a rule from the list

Each rule in the list has the following actions, depending on your permissions:

- **Edit**: Opens the rule in the rule editor.
- **More** -> **View**: Opens the rule details page.
- **More** -> **Duplicate**: Creates a copy of the rule that you can edit before saving.
- **More** -> **Copy link**: Copies a link to the rule details page.
- **More** -> **Pause** or **Resume**: Pauses or resumes the evaluation of the rule.
- **More** -> **Delete**: Deletes the rule.
- **More** -> **Silence notifications**: Creates a silence for the alert rule. Alert rules only.

To create a rule, click **New alert rule** on the **Alert rules** page or **New recording rule** on the **Recording rules** page.

## View, compare and restore alert rules versions

To view, compare, or restore previous versions for an alert rule, complete the following steps.

1. Navigate to **Alerts & IRM** -> **Alerting** -> **Alert rules**.
1. Click the name of the alert rule to open the rule details page.
1. Click the **Versions** tab.  
   The page displays a list of the previous rule versions.

On the Alert rule's Versions page you can view, compare and restore the previous rule versions.

{{< figure src="/media/docs/alerting/screenshot-grafana-alerting-version-history-v3.png" max-width="750px" alt="View alert rule history to compare and restore previous alert rules." >}}

{{< admonition type="note" >}}

- The alert rule does not guarantee sequential version increases.

- In Grafana OSS and Enterprise, the number of alert rule versions can be limited using the [`rule_version_record_limit` option](/docs/grafana/latest/setup-grafana/configure-grafana/#rule_version_record_limit). In Grafana Cloud, free users are allowed a maximum of 10 alert rule versions, while paid users have a maximum of 100 stored alert rule versions.
  {{< /admonition >}}

## Restore deleted rules

Only users with an Admin role can view and restore deleted rules. The **Alert rules** and **Recording rules** pages each have a **Recently deleted** tab that lists the deleted rules of that type.

1. Go to **Alerts & IRM** -> **Alerting** -> **Alert rules** or **Recording rules**, then click the **Recently deleted** tab.
1. (Optional) Click **Review** to view the details of the deleted rule.
1. Click **Restore** to restore the rule.

{{< admonition type="note" >}}
Deleted alert rules are stored for 30 days. Grafana Enterprise and OSS users can adjust the length of time for which the rules are stored in the Grafana configuration file's `[unified_alerting].deleted_rule_retention` field. For an example of how to modify the Grafana configuration file, refer to the [documentation example here](/docs/grafana/latest/alerting/set-up/configure-alert-state-history/#configuring-grafana).  
{{< /admonition >}}
