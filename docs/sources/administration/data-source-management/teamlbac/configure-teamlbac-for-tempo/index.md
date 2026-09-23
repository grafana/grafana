---
title: Configure LBAC for Tempo or Cloud Traces
description: Use label-based access control (LBAC) to restrict Cloud Traces data by team and attribute rules.
keywords:
  - tempo
  - datasource
  - team
labels:
  products:
    - cloud
weight: 350
review_date: 2026-09-23
---

# Configure LBAC for Tempo or Cloud Traces

{{< docs/public-preview product="Label-based access control for traces" >}}

This document explains how to configure Label-Based Access Control (LBAC) for data sources for a Tempo or Cloud Traces data source. LBAC for data sources lets you restrict which spans a team can access by defining rules based on trace attributes, providing fine-grained, team-based access control within a single tenant. It mirrors the experience used for logs and metrics LBAC in Grafana Cloud.

Grafana uses LBAC as an umbrella term for label-based access control across all data sources. Traces use **attributes**, not labels, for access control, but the Grafana UI surfaces this functionality as LBAC for consistency. This feature applies only to Grafana Cloud Traces, specifically the Cloud-provisioned tracing data source.

{{< admonition type="note" >}}
Unlike logs and metrics, which also support data source-level LBAC through cloud access policies, traces LBAC is available only at the team level.
{{< /admonition >}}

## How LBAC works

When a user queries a tracing data source, Grafana evaluates the user's team memberships and the LBAC rules assigned to those teams. Grafana adds these rules to the request, so the Cloud Traces data source returns only permitted spans or attributes.

LBAC rules use attribute selectors, such as:

```traceql
{ resource.service.name="checkout", resource.env="prod" }
```

Multiple conditions in the same rule are combined with `AND` (`,`), while multiple rules across teams are combined with `OR`.

## Before you begin

Before you configure LBAC for data sources, ensure you have the following:

- Permission to create a Tempo or Cloud Traces tenant in Grafana Cloud.
- Administrator permissions for Grafana.
- A team set up in Grafana.

## Known limitations

Be aware of the following limitations for traces LBAC:

- LBAC for traces is available only at the team level. Data source-level LBAC rules, configured through cloud access policies, aren't currently supported for traces. This differs from logs and metrics LBAC, which supports both team-level and data source-level rules.
- Autocomplete in search is still under development.
- Rules are restricted to resource scope attributes.
- Users with multiple rules may experience a slight performance degradation.

## Configure a new Tempo or Cloud Traces data source

Follow this workflow when adding a new data source. The data source must be hosted by Grafana and not self-managed.

1. Start your Grafana Cloud instance.
1. Access Tempo or Cloud Traces data source details for your stack.
1. Copy the [details of your Tempo or Cloud Traces setup](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/locate-url-user-password/).
1. In Grafana Cloud, navigate to **Administration** > **Users and access** > **Cloud Access Policies**.
   - Create an access policy for the Tempo or Cloud Traces data source.
   - Ensure the access policy includes `traces:read` permissions.
   - Ensure the access policy doesn't include `labels` rules. Data source-level LBAC isn't supported for traces, so any `labels` rules in the access policy are ignored.
1. In Grafana, select the Tempo or Cloud Traces data source, or create a new one.
1. Navigate back to the Tempo or Cloud Traces data source.
   - Set up the data source using basic authentication. Use the [userID or tenantID](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/locate-url-user-password/) as the username. Use the token from your access policy as the password.
   - Select **Save & test**.
1. Go to the **Permissions** tab of the newly created data source. Here, you find the LBAC for data sources rules section.
1. Choose a team from the **Team** drop-down.
1. Enter attribute selectors, such as:

   ```traceql
   { resource.service.name="checkout", resource.env="prod" }
   ```

1. Select **Save**.

## Examples of LBAC rules

An LBAC rule for traces is an attribute selector that filters spans based on trace attributes. Each rule operates independently as its own filter, separate from other rules within a team.

Follow these guidelines when you write rules:

- Use only resource scope attributes, for example `{ resource.env="prod" }`.
- Use double quotes for string values. Only string values are supported.
- Use the `=~` operator for regular expression matching, for example `{ resource.team =~ "team-a|team-b" }`.
- Use up to two conditions in a single rule, separated by a comma (`,`), which acts as an `AND` operator.

For more detail, refer to [Create LBAC for data sources rules for a supported data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/).

### Single rule

Multiple conditions in a single rule are combined with `AND`. The following rule grants access to spans that match both `resource.service.name="payments-api"` and `resource.env="prod"`:

```traceql
{ resource.service.name="payments-api", resource.env="prod" }
```

### Match multiple values with a regular expression

Use the `=~` operator to match an attribute against a regular expression. The following rule grants access to spans from `team-a` or `team-b`:

```traceql
{ resource.team =~ "team-a|team-b" }
```

### Multiple rules

Multiple rules assigned to the same team are combined with `OR`. The following two rules grant access to spans in the `prod` environment or spans from the `billing` team:

```traceql
{ resource.env="prod" }
{ resource.team="billing" }
```

### User on multiple teams

Users on multiple teams receive access based on all the combined rules assigned to each team, combined with `OR`. For example, if the teams have the following rules:

- Team A: `{ resource.cluster="us-east-1" }`
- Team B: `{ resource.service.name="frontend" }`

A user on both teams can access spans that match `resource.cluster="us-east-1"` or `resource.service.name="frontend"`.

## How LBAC affects returned data

Cloud Traces supports three redaction modes that control how unauthorized spans are handled in trace-by-ID search responses. The active mode is configured per tenant. To change the mode for your organization, contact Grafana Support.

### Attributes mode (default)

Non-matching spans are included in the response, but their attributes and intrinsics are redacted. Only the following minimal fields remain visible on redacted spans:

- `traceId`, `spanId`, `parentId`
- `name`, `kind`
- `timestamps`
- `status`

You can extend the set of always-visible fields by configuring `allowed_attributes`, which sets a list of scoped attributes and intrinsics that are never redacted. For example, you can set `span:name`, `resource.service.name`, `event:name`, or `scope.version` so they're never redacted, even on non-matching spans. Contact Grafana Support to configure `allowed_attributes` for your organization.

### Spans mode

Non-matching spans are removed from the response entirely. This can result in broken traces where a returned span has no matching parent, creating gaps in the span tree.

### Error mode

If any span in a requested trace doesn't match the LBAC policy, the entire request returns a `404` error. This is the strictest mode and suits environments where partial trace visibility isn't acceptable.

For search, metrics, and autocomplete endpoints, only spans that match the LBAC rules appear, regardless of the configured redaction mode.

## Manage LBAC rules

You can edit or delete existing LBAC rules from the data source's **Permissions** tab.

### Edit an LBAC rule

1. Open your stack and select your **Tempo** or **Cloud Traces** data source.
1. Select **Permissions**.
1. Scroll to **Data access**.
1. Select the rule you want to edit and select the pencil (edit) icon.
1. Modify the **Attribute filters**.
1. Select **Save**.

### Delete an LBAC rule

1. Open your stack and select your **Tempo** or **Cloud Traces** data source.
1. Select **Permissions**.
1. Scroll to **Data access**.
1. Select the rule you want to delete.
1. Select the **X** (delete) icon.
1. Confirm the deletion.

## Related resources

- [LBAC for data sources overview](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/) explains how LBAC works, which data sources are supported, and current limitations.
- [Create LBAC for data sources rules for a supported data source](https://grafana.com/docs/grafana/<GRAFANA_VERSION>/administration/data-source-management/teamlbac/create-teamlbac-rules/) explains how to define and manage rules.
