---
description: Learn how to create LBAC for data sources rules for a supported data source.
keywords:
  - grafana
  - loki
  - prometheus
  - mimir
  - tempo
  - traces
  - metrics
  - lbac
  - team
labels:
  products:
    - enterprise
    - cloud
menuTitle: Create LBAC rules
title: Create LBAC for data sources rules
weight: 100
review_date: 2026-09-22
---

# Create LBAC for data sources rules

LBAC for data sources works with supported data sources that use basic authentication. You can't add LBAC rules to a file-provisioned data source, and provisioned data sources are read-only in the UI. Create the data source first, then add its LBAC rules on the **Permissions** tab or provision them with the Grafana Terraform provider.

## Before you begin

Before you start, ensure you have:

- **Tenant permissions:** Permission to create the tenant for your data source, such as a Loki tenant, in Grafana Cloud or in Grafana Enterprise Metrics or Grafana Enterprise Logs.
- **Data source permissions:** `Admin` permission on the data source in Grafana.
- **A team:** At least one team set up in Grafana.

## Create an LBAC for data sources rule for a team

To add an LBAC rule to a team:

1. Navigate to your data source.
1. Select the **Permissions** tab. The LBAC for data sources rules section appears on this tab.
1. In the LBAC for data sources rules section, add a new rule for the team.
1. Define a label selector for the rule. For the selector syntax, refer to [LBAC rules](#lbac-rules). For data source-specific guidance, refer to the configuration guides in [Next steps](#next-steps).

## LBAC rules

An LBAC rule is a LogQL query that filters logs or metrics based on labels. Each rule operates independently as its own filter, separate from other rules within a team.

For example:

- **Logs:** `{namespace="dev", cluster="us-west-0"}` returns log lines that match both `namespace="dev"` and `cluster="us-west-0"`.
- **Metrics:** `{job="api-server", region="europe"}` returns metric data points that match both `job="api-server"` and `region="europe"`.

Within a single rule, comma-separated selectors combine with **AND**. For example, the rule `{namespace="dev", cluster="us-west-0"}` matches data where `namespace="dev"` **AND** `cluster="us-west-0"`.

Across a team, multiple rules combine with **OR**. For example, the two rules `{namespace="dev"}` and `{cluster="us-west-0"}` match data where `namespace="dev"` **OR** `cluster="us-west-0"`.

{{< admonition type="note" >}}
An `Admin` user who's a member of one or more teams with LBAC rules can access only the logs or metrics allowed by those teams' rules. An `Admin` user who isn't a member of any team with LBAC rules can access all logs or metrics.
{{< /admonition >}}

### Traces rules

For Tempo and Cloud Traces, rules use attribute selectors rather than LogQL labels. This functionality is in public preview, and traces LBAC is available only at the team level. Use resource-scope attributes, for example:

```
{ resource.service.name="checkout", resource.env="prod" }
```

The same logic applies as for logs and metrics: comma-separated conditions in one rule combine with **AND**, and multiple rules across a team combine with **OR**. For more information, refer to [Configure team LBAC for Tempo or Cloud Traces](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-tempo/).

### Best practices

Follow these recommendations when you set up rules:

- Grant `Query` permission only to teams that should use the data source, and grant `Admin` permission only to administrators.
- Give every team that should be restricted its own rule. A team that has `Query` permission but no rule can query all logs or metrics.
- Remove label selectors from the Cloud Access Policy for the data source. Cloud Access Policy rules override LBAC for data sources rules.
- For a first setup, create as few rules as possible for each team and prefer rules that grant access over rules that exclude data, because access is the union of all rules.
- Use a dedicated data source for LBAC, and keep a separate data source without LBAC for full access, so the separation is clear.
- Manage rules as code with the Grafana Terraform provider for repeatable, reviewable setups.
- To validate rules, test them in [Explore](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/explore/). Explore shows the logs or metrics that a rule returns.

## Examples

The following examples show how different rule and team configurations affect access. Unless stated otherwise, each team has `Query` permission on the data source and administrators have `Admin` permission only.

### One rule for each team

A common use case is to grant a team access to data that has a specific label. In this example, Team A and Team B each have one rule:

- Team A has the rule `namespace="dev"`.
- Team B has the rule `namespace="prod"`.

A user in Team A can access logs or metrics that match `namespace="dev"`. A user in both Team A and Team B can access data that matches `namespace="dev"` **OR** `namespace="prod"`.

### Multiple rules for one team

A team can have more than one rule, and its members can access data that matches any of them. In this example, Team A has two rules:

- Rule 1: `namespace="dev"`
- Rule 2: `namespace="prod"`

A user in Team A can access logs or metrics that match `namespace="dev"` **OR** `namespace="prod"`.

### Exclude a label for a team

You can exclude data that has a specific label. For example, to exclude all log lines labeled `secret="true"`, add the selector `secret!="true"`. In this example, Team A has one rule:

- Team A has the rule `secret!="true"`.

A user in Team A can access logs or metrics that match `secret!="true"`, which is all data except data labeled `secret="true"`.

### Rules with multiple conditions

A single rule can combine multiple conditions with **AND**. In this example, Team A and Team B each have one rule:

- Team A has the rule `cluster="us-west-0", namespace=~"dev|prod"`.
- Team B has the rule `cluster="us-west-0", namespace="staging"`.

The `=~` operator matches a regular expression, so `namespace=~"dev|prod"` matches either `dev` or `prod`.

A user in only Team A can access logs or metrics that match `cluster="us-west-0"` **AND** (`namespace="dev"` **OR** `namespace="prod"`).

A user in only Team B can access logs or metrics that match `cluster="us-west-0"` **AND** `namespace="staging"`.

A user in both Team A and Team B can access logs or metrics that match `cluster="us-west-0"` **AND** (`namespace="dev"`, `namespace="prod"`, or `namespace="staging"`), because rules across teams combine with **OR**.

A user with an `Editor` or `Viewer` role who isn't a member of any team can't query logs or metrics, because in this setup only teams have `Query` permission on the data source.

### Rules that overlap

Two teams can have rules that overlap. In this example:

- Team A has the rule `namespace="dev"`.
- Team B has the rule `namespace!="dev"`.

A user in Team A can access logs or metrics that match `namespace="dev"`.

A user in Team B can access logs or metrics that match `namespace!="dev"`.

{{< admonition type="note" >}}
A user in both Team A and Team B can access all data, because the rules combine as `namespace="dev"` **OR** `namespace!="dev"`.
{{< /admonition >}}

### Team without a rule

When a team has no LBAC rule, its members can access all logs or metrics, subject to their data source permission. In this example, the `Editor` and `Viewer` roles have `Query` permission:

- Team A has the rule `namespace="dev"`.
- Team B has no rule configured.

A user in only Team A can access logs or metrics that match `namespace="dev"`.

A user in both Team A and Team B can access logs or metrics that match `namespace="dev"`.

A user in only Team B with an `Editor` or `Viewer` role can access all logs or metrics, because Team B has no rule and the user has `Query` permission.

### Administrator on a team with a rule

An administrator's basic role doesn't bypass LBAC rules when the administrator is a member of a team that has rules. In this example, User A has an `Admin` basic role and is a member of Team B:

- Team B has no roles assigned.
- Team B has `Query` permission on the data source.
- Team B has the rule `{ project_id="project-dev" }`.

User A can access only logs or metrics that match `{ project_id="project-dev" }`.

## Next steps

Set up LBAC for data sources for your data source:

- [Configure LBAC for data sources for Loki](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-loki/)
- [Configure LBAC for data sources for Prometheus](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-prometheus/)
- [Configure team LBAC for Tempo or Cloud Traces](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/configure-teamlbac-for-tempo/)
