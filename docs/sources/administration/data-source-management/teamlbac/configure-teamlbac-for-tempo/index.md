---
title: "Configure Team LBAC for Tempo or Cloud Traces"
description: "Use label-based access control (LBAC) to restrict Grafana Cloud Traces data by team and attribute rules."
keywords:
  - tempo
  - datasource
  - team
labels:
  products:
    - cloud
title: Configure team LBAC for data sources for Tempo
weight: 350
_build:
  list: false
noindex: true
---

# Configure team label-based access control for Tempo or Cloud Traces

{{< docs/private-preview product="Label-based access control for traces" >}}

Team label-based access control (LBAC) for Grafana Cloud Traces or Tempo lets you restrict which spans teams can access by defining rules using trace attributes. LBAC provides fine-grained, team-based access control within a single tenant and mirrors the experience used for metrics, logs, and traces LBAC in Grafana Cloud.

Grafana uses the term LBAC as an umbrella term for label-based access control for all data sources.
Traces use **attributes**, not labels, for access control, but the Grafana UI surfaces this functionality as LBAC for consistency.

This feature only applies to Grafana Cloud Traces, specifically, the Grafana Cloud-provisioned tracing data source.
If you want to use this feature with a Tempo data source, contact Grafana Support to make sure that this is enabled in your organization.

## How LBAC works

When you query the tracing data source, Grafana evaluates the user’s team memberships and the LBAC rules assigned to those teams. These rules are added to the request so the Grafana Cloud Traces data source returns only permitted spans or attributes.

LBAC rules use **attribute selectors**, such as:

```
{ resource.service.name="checkout", resource.env="prod" }
```

Multiple conditions in the same rule use **AND** (`,`), while multiple rules across teams use **OR**.

## Before you begin

- Ensure you have permission to create a Tempo or Grafana Cloud Traces tenant in Grafana Cloud.
- Ensure you have administrator permissions for Grafana.
- Ensure you have a team set up in Grafana.

### Known limitations

LBAC for traces has these limitations:

- Autocomplete in search is still under development.
- LBAC is restricted to resource scope attributes only.
- There is a slight performance impact for users with multiple rules.

## Configure team LBAC for traces

Follow this workflow when adding a new data source. The data source must be hosted by Grafana, not self-managed.

1. Start your Grafana Cloud instance.
2. Access Tempo or Grafana Cloud Traces data source details for your stack.
3. Copy Tempo or Grafana Cloud Traces details and create a Cloud Access Policy.
   - Copy the [details of your Tempo or Grafana Cloud Traces setup](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/locate-url-user-password/).
4. In Grafana Cloud, navigate to **Administration > Users and access > Cloud Access Policies**.
   - Create an access policy for the Tempo or Grafana Cloud Traces data source.
   - Ensure the access policy includes `traces:read` permissions.
   - Ensure the access policy doesn't include `labels` rules.
5. In Grafana, select Tempo or Grafana Cloud Traces, or create a new data source.
6. Navigate back to the Tempo or Grafana Cloud Traces data source.
   - Set up the Tempo or Grafana Cloud Traces data source using basic authentication. Use the [userID/tenantID](https://grafana.com/docs/grafana-cloud/send-data/traces/set-up/locate-url-user-password/) as the username. Use the token from your access policy as the password.
   - Select **Save and connect**.
7. Go to the **Permissions** tab of the newly created Tempo or Grafana Cloud Traces data source to find the LBAC for data sources rules section.

8. Choose a team from the **Team** dropdown.
9. Enter attribute selectors such as:

   ```
   { resource.service.name="checkout", resource.env="prod" }
   ```

   Refer to the example rules for more guidance.

10. Select **Save**.

### Examples of LBAC rules

An LBAC rule is a `logql` query that filters logs or metrics based on labels.
LBAC rules for traces also use some TraceQL syntax for attribute selection.
Each rule operates independently as its own filter, separate from other rules within a team.

LBAC rules guidelines:

- Use only resource scope attributes, for example, `{ resource.env="prod" }`.
- Only string values are supported.
- Use double quotes for string values, for example, `{ resource.env="prod" }`.
- Use regular expressions with the `=~` operator, for example, `{ resource.team =~ "team-a|team-b" }`.
- LBAC doesn't support `nil`; you can't match spans where an attribute doesn't exist.
- Use a comma (`,`) as an `AND` operator for up to two conditions per rule, for example, `{ resource.env="prod", resource.team="frontend" }`.

#### Attribute existence and missing attributes

Attribute selectors use exact-match semantics.
For example, a selector like `{ resource.restricted = false }` matches only spans where the attribute exists and equals that value.
If the attributes referenced in a rule do not exist on a span, that span is skipped and doesn't appear in the results.

LBAC doesn't support `nil`, so you can't match spans where an attribute isn't set. If you want "allow when restricted=false or when attribute absent" semantics, you can't achieve that with LBAC.
To allow access only when an attribute is explicitly not restricted, use a single rule such as `{ resource.restricted = false }`.
Note that this example excludes spans that don't have the `restricted` attribute.

Refer to [Create LBAC for data sources rules for a supported data source](https://grafana.com/docs/grafana/next/administration/data-source-management/teamlbac/create-teamlbac-rules/) for more information.

#### Single rule

Limit users to only see spans from the `payments` API.

```
{ resource.service.name="payments-api" }
```

This example matches spans with team A or team B. A single rule is faster than multiple rules with the same attribute.

```
{ resource.team =~ "team-a|team-b" }
```

#### Multiple rules

Combine two rules to give users access to spans from the `prod` environment or the `billing` team:

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

If you're on multiple teams, you receive access based on all LBAC rules assigned to those teams combined.

Team A → `{ resource.cluster="us-east-1" }`
Team B → `{ resource.service.name="frontend" }`

#### Restrict access by a boolean attribute

To allow access only when spans are not restricted (either explicitly `restricted = false` or when the attribute is absent), use two rules.
For example, a single rule `{ resource.restricted = false }` would exclude spans that do not have the `restricted` attribute at all.

```
{ resource.restricted = false }
```

## How LBAC affects returned data

For Trace-by-ID endpoints, spans that don't match your LBAC rules show only minimal intrinsic fields:

- `traceId`, `spanId`, `parentId`
- `name`, `kind`
- `timestamps`
- `status`

For search, metrics, and autocomplete, only spans that match your LBAC rules appear.

## Manage LBAC rules

To edit an existing LBAC rule, follow these steps:

1. Open your stack and select your **Tempo** or **Grafana Cloud Traces** data source.
2. Select **Permissions**.
3. Scroll to **Data access**.
4. Select the rule you want to edit and select **Edit**.
5. Modify **Attribute filters**.
6. Select **Save**.

To delete an existing LBAC rule, follow these steps:

Open your stack and select your **Tempo** or **Cloud Traces** data source.

1. Open your stack and select your **Tempo** or **Grafana Cloud Traces** data source.
2. Select **Permissions**.
3. Scroll to **Data access**.
4. Select the rule you want to delete.
5. Select **Delete**.
6. Confirm deletion.
