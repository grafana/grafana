---
title: "Configure LBAC for Tempo or Cloud Traces"
description: "Use label-based access control (LBAC) to restrict Cloud Traces data by team and attribute rules."
keywords:
  - tempo
  - datasource
  - team
labels:
  products:
    - cloud
title: Configure LBAC for data sources for Tempo
weight: 350
_build:
  list: false
noindex: true
---

# Configure label-based access control for Tempo or Cloud Traces

Label-based access control (LBAC) for Cloud Traces or Tempo lets you restrict which spans users and teams can access by defining rules using trace attributes. LBAC provides fine-grained, team-based access control within a single tenant and mirrors the experience used for logs and metrics LBAC in Grafana Cloud.

Grafana uses the term LBAC as an umbrella term for label-based access control for all data sources.
Traces use **attributes**, not labels, for access control, but the Grafana UI surfaces this functionality as LBAC for consistency.

## How LBAC works

When a user queries tracing data source, Grafana evaluates the user’s team memberships and the LBAC rules assigned to those teams. These rules are added to the request so the Tempo or Cloud Traces data source returns only permitted spans or attributes.

LBAC rules use **attribute selectors**, such as:

```
{ resource.service.name="checkout", resource.env="prod" }
```

Multiple conditions in the same rule use **AND**, while multiple rules across teams use **OR**.

## Configure LBAC for a new Tempo or Cloud Traces data source

Follow this workflow when adding a new data source.

1. Access Tempo or Cloud Traces data sources details for your stack through grafana.com
1. Copy Tempo or Cloud Traces details and create a CAP
   - Copy the details of your Tempo or Cloud Traces setup.
   - Create a Cloud Access Policy (CAP) for the Tempo or Cloud Traces data source in grafana.com.
   - Ensure the CAP includes `traces:read` permissions.
   - Ensure the CAP does not include `labels` rules.
1. Create a new Tempo or Cloud Traces data source
   - In Grafana, proceed to add a new data source and select Tempo or Cloud Traces as the type.
1. Navigate back to the Tempo or Cloud Traces data source
   - Set up the Tempo or Cloud Traces data source using basic authentication. Use the userID as the username. Use the generated CAP token as the password.
   - Save and connect.
1. Navigate to data source permissions
   - Go to the permissions tab of the newly created Tempo or Cloud Traces data source. Here, you'll find the LBAC for data sources rules section.

1. Choose a team from the **Team** dropdown.
1. Enter attribute selectors such as:

   ```
   { resource.service.name="checkout", resource.env="prod" }
   ```

1. Select **Save**.

## Add an LBAC rule to an existing data source

1. In grafana.com, open your stack and select your **Tempo or Cloud Traces** data source.
2. Select **Permissions**.
3. Scroll to **Data access**.
4. Select **+ Add a LBAC rule**.
5. Choose the **Team**.
6. Add selectors in **Attribute filters**.
7. Select **Save**.

## How LBAC affects returned data

For Trace-by-ID endpoints, unauthorized spans show only minimal intrinsic fields:

- `traceId`, `spanId`, `name`, `kind`
- `timestamps`
- `status`
- `links`

For Search, metrics, tags, and tag-values, only spans matching LBAC rules appear.

Unsupported endpoints return an error when LBAC rules are active.

## Manage LBAC rules

To edit an existing LBAC rule, follow these steps:

1. In grafana.com, open your stack and select your **Tempo or Cloud Traces** data source.
2. Select **Permissions**.
3. Scroll to **Data access**.
4. Select the rule you want to edit.
5. Modify **Attribute filters**.
6. Select **Save**.

## Examples

### Single rule

```
{ resource.service.name="payments-api" }
```

### Multiple rules

```
{ resource.env="prod" }
{ resource.team="checkout" }
```

### User on multiple teams

Team A → `{ resource.cluster="us-east-1" }`
Team B → `{ resource.service.name="frontend" }`

User access = spans matching either rule.
