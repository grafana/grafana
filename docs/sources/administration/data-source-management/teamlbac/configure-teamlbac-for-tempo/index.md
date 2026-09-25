---
description: 'Use label-based access control (LBAC) to restrict Cloud Traces data by team and attribute rules.'
keywords:
  - tempo
  - datasource
  - team
labels:
  products:
    - cloud
title: Configure team LBAC for data sources for Tempo
weight: 350
---

# Configure team label-based access control for Tempo or Cloud Traces

{{< docs/public-preview product="Label-based access control for traces" >}}

Team label-based access control (LBAC) for Cloud Traces or Tempo lets you restrict which spans teams can access by defining rules using trace attributes. LBAC provides fine-grained, team-based access control within a single tenant and mirrors the experience used for logs and metrics LBAC in Grafana Cloud.

{{< admonition type="note" >}}
Unlike logs and metrics, which also support data source-level LBAC through cloud access policies, traces LBAC is currently available only at the team level.
{{< /admonition >}}

Grafana uses the term LBAC as an umbrella term for label-based access control for all data sources.
Traces use **attributes**, not labels, for access control, but the Grafana UI surfaces this functionality as LBAC for consistency.

This feature only applies to Grafana Cloud Traces, specifically, the Cloud-provisioned tracing data source.

## How LBAC works

When a user queries tracing data source, Grafana evaluates the user’s team memberships and the LBAC rules assigned to those teams. These rules are added to the request so the Cloud Traces data source returns only permitted spans or attributes.

LBAC rules use **attribute selectors**, such as:

```
{ resource.service.name="checkout", resource.env="prod" }
```

Multiple conditions in the same rule use **AND** (`,`), while multiple rules across teams use **OR**.

## Before you begin

To use team LBAC for Tempo or Cloud Traces, you need to have the following:

- The permission setup to create a Tempo or Cloud Traces tenant in Grafana Cloud
- Administrator permissions for Grafana
- A team setup in Grafana

Team LBAC works with Grafana Cloud and Grafana Enterprise v12.3 and later when the data source uses Grafana Cloud Traces. It doesn't work with self-hosted Tempo OSS or Grafana Enterprise Traces (GET).

### Known limitations

- LBAC for traces is available only at the team level. Data source-level LBAC rules (configured through cloud access policies) aren't currently supported for traces. This differs from logs and metrics LBAC, which supports both team-level and data source-level rules.
- Autocomplete in search is still under development.
- LBAC is restricted to only contain resource scope attributes.
- There is a slight performance degradation for users with multiple rules.

## Configure team LBAC for traces

Follow this workflow when adding a new data source. The data source must be hosted by Grafana and not self-managed.

1. Start your Grafana Cloud instance.
2. Access Tempo or Cloud Traces data sources details for your stack.
3. Copy Tempo or Cloud Traces details and create a Cloud Access Policy.
   - Copy the [details of your Tempo or Cloud Traces setup](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/locate-url-user-password/).
4. In Grafana Cloud, navigate to **Administration > Users and access > Cloud Access Policies**.
   - Create an access policy for the Tempo or Cloud Traces data source.
   - Ensure the access policy includes `traces:read` permissions.
   - Ensure the access policy doesn't include `labels` rules. Data source-level LBAC isn't supported for traces, so any `labels` rules in the access policy are ignored.
5. In Grafana, select Tempo or Cloud Traces or create new data source.
6. Navigate back to the Tempo or Cloud Traces data source.
   - Set up the Tempo or Cloud Traces data source using basic authentication. Use the [userID/tenantID](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/locate-url-user-password/) as the username. Use the token from your access policy as the password.
   - Select **Save and connect**.
   - After a successful connection test, the data source is ready to use.
7. Go to the **Permissions** tab of the newly created Tempo or Cloud Traces data source. Here, you find the LBAC for data sources rules section.
   The **Data access** section shows the LBAC rules UI for the selected data source.

8. Choose a team from the **Team** dropdown.
9. Enter attribute selectors such as:

   ```
   { resource.service.name="checkout", resource.env="prod" }
   ```

   Refer to the Examples section below for more examples.

10. Select **Save**.
    The rule appears under the team's attribute filters. Team members see only spans matching the rule in Explore search and metrics.

### Examples of LBAC rules

LBAC rules for traces use TraceQL attribute selector syntax.
Each rule operates independently as its own filter, separate from other rules within a team.

LBAC rules guidelines:

- Use only resource scope attributes, for example `{ resource.env="prod" }`.
- Only string values are supported.
- Use double quotes for string values, for example: `{ resource.env="prod" }`.
- You can use regular expressions matching with `=~` operator, for example: `{ resource.team =~ "team-a|team-b" }`.
- If you use negation (`!=` or `!~`), refer to [Troubleshoot missing service traces](#troubleshoot-missing-service-traces). TraceQL negation behaves differently from PromQL when an attribute is missing.
- You can have up to two conditions in the same rule using a comma (`,`) as an `AND` operator, for example: `{ resource.env="prod", resource.team="frontend" }`.

Refer to [Create LBAC for data sources rules for a supported data source](https://grafana.com/docs/grafana/next/administration/data-source-management/teamlbac/create-teamlbac-rules/) for more information.

#### Single rule

Limit users to only see spans from the `payments` API.

```
{ resource.service.name="payments-api" }
```

This example matches spans with team A **or** team B. This single example is faster than using multiple rules with the same label.

```
{ resource.team =~ "team-a|team-b" }
```

#### Multiple rules

Two rules combined to give user access to spans from `prod` environment or the `billing` team.

```
{ resource.env="prod" }
{ resource.team="billing" }
```

This example gives users access to spans from the `frontend` team in the `prod` environment or the `checkout` team but doesn't enforce additional conditions. The comma (`,`) acts as an `AND` operator within the same rule.

```
{ resource.env="prod", resource.team="frontend" }
{ resource.team="checkout" }
```

#### User on multiple teams

Users on multiple teams receive access based on all combined LBAC rules assigned to each team.

Team A → `{ resource.cluster="us-east-1" }`
Team B → `{ resource.service.name="frontend" }`

## How LBAC affects returned data

Cloud Traces supports three redaction modes that control how unauthorized spans are handled in trace by ID search responses. The active mode is configured per tenant. To change the mode for your organization, contact Grafana Support.

### Attributes mode (default)

Non-matching spans are included in the response but have their attributes and intrinsics redacted. Only the following minimal fields remain visible on redacted spans:

- `traceId`, `spanId`, `parentId`
- `name`, `kind`
- `timestamps`
- `status`

You can extend the set of always-visible fields by configuring `allowed_attributes`, which sets a list of scoped attributes and intrinsics that are never redacted, For example, you can set `span:name`, `resource.service.name`, `event:name`, or `scope.version` so they are never redacted, even from non-matching spans. Contact Grafana Support to configure `allowed_attributes` for your organization.

### Spans mode

Non-matching spans are removed from the response entirely. This can result in broken traces where a returned span has no matching parent, creating gaps in the span tree.

### Error mode

If any span in a requested trace does not match the LBAC policy, the entire request returns a 404 error. This is the strictest mode and is suited for environments where partial trace visibility is not acceptable.

For Search, metrics, and autocomplete endpoints, only spans matching the LBAC rules appear regardless of the configured redaction mode.

## Troubleshoot missing service traces

If a team can't see traces from a service you expect, a negation rule combined with a missing attribute may be excluding those spans.

If you're familiar with PromQL label matching, TraceQL attribute selectors behave differently for negation.

In PromQL, `labelFoo != "abc"` matches series that don't have `labelFoo` or have a value other than `"abc"`.
In TraceQL, `resource.attr != "abc"` and `resource.attr !~ "abc"` match only spans that **have** `resource.attr` and whose value matches the condition.
Spans that don't include that attribute aren't returned.

This difference matters when you combine attributes in one rule with `,` (AND).
For example, this rule matches only spans from `checkout-api` that also have the `resource.k8s.namespace.name` attribute.
Services such as `checkout-api` that don't set `resource.k8s.namespace.name` won't match, even if you want to include them.

```
{ resource.service.name="checkout-api", resource.k8s.namespace.name !~ "prod-main" }
```

To include services that don't set the attribute, add a separate rule for each service.
Multiple rules for a team combine with **OR**:

```
{ resource.service.name="checkout-api", resource.k8s.namespace.name !~ "prod-main" }
{ resource.service.name="checkout-api" }
```

Add similar OR rules for other services that don't set the namespace attribute.

To find services that don't set an attribute, run this query in Grafana Explore:

```
{ resource.k8s.namespace.name = nil } | rate() by (resource.service.name)
```

This query returns services that don't have `resource.k8s.namespace.name` set.

## Manage LBAC rules

To edit an existing LBAC rule, follow these steps:

1. Open your stack and select your **Tempo** or **Cloud Traces** data source.
2. Select **Permissions**.
3. Scroll to **Data access**.
4. Select the rule you want to edit and click the Pencil (Edit) icon.
5. Modify **Attribute filters**.
6. Select **Save**.

To delete an existing LBAC rule, follow these steps:

1. Open your stack and select your **Tempo** or **Cloud Traces** data source.
2. Select **Permissions**.
3. Scroll to **Data access**.
4. Select the rule you want to delete.
5. Select the **X** (Delete) icon.
6. Confirm deletion.

## Next steps

- Refer to [Label Based Access Control (LBAC) for data sources](../_index/) for an overview and supported data sources.
- Refer to [Create LBAC for data sources rules for a supported data source](../create-teamlbac-rules/) for rule-creation reference.
- Refer to [Construct a TraceQL query](https://grafana.com/docs/tempo/<TEMPO_VERSION>/traceql/construct-traceql-queries/) for attribute selector syntax, including `!=`, `!~`, and `= nil`.
- Refer to [Search traces using the query builder](/docs/grafana/<GRAFANA_VERSION>/datasources/tempo/query-editor/traceql-search/) to run the diagnostic query in Explore.
