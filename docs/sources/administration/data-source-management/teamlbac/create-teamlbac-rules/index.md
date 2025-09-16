---
description: Learn how to create LBAC for data sources rules for a supported data source.
keywords:
  - loki
  - lbac
  - team
labels:
  products:
    - cloud
title: Create LBAC for data sources rules for a supported data source
weight: 250
---

# Create LBAC for data source rule

LBAC for data sources is available for LBAC-supported data sources created with basic authentication. As of today, managed/provisioned data source can **NOT** be configured with LBAC rules.

## Before you begin

- Be sure that you have the permission setup to create a Loki tenant in Grafana Cloud.
- Be sure that you have admin data source permissions for Grafana.
- Be sure that you have a team setup in Grafana.

### Create a LBAC for data sources rule for a team

1. Navigate to your data source
1. Navigate to the permissions tab
   - Here, you'll find the LBAC for data sources rules section.
1. Add a LBAC for data sources Rule
   - Add a new rule for the team in the LBAC for data sources rules section.
1. Define a label selector for the rule
   - Add a label selector to the rule. Refer to documentation for guidance on the types of log selections you can specify.

### LBAC rule

An LBAC rule is a `logql` query that filters logs or metrics based on labels. Each rule operates independently as its own filter, separate from other rules within a team.

For example:

- For logs: `{namespace="dev", cluster="us-west-0"}` filters log lines matching both `namespace="dev"` and `cluster="us-west-0"`.
- For metrics: `{job="api-server", region="europe"}` filters metric data points matching `job="api-server"` and `region="europe"`.

One rule `{namespace="dev", cluster="us-west-0"}` created with multiple namespaces will be seen as `namespace="dev"` **AND** `cluster="us-west-0"`.
Two rules `{namespace="dev"}`, `{cluster="us-west-0"}` created for a team will be seen as `namespace="dev"` **OR** `cluster="us-west-0"`.

#### Best practices

We recommend you only add `query` permissions for teams that should use the data source and only `Admin` have `Admin` permissions.

We recommend for a first setup, setting up as few rules as possible for each team and make them additive for simplicity.

To validate the rules, we recommend testing the rules in the Explore view. This will allow you to see the metrics or logs that would be returned for the rule.

#### Tasks

### Task 1: One rule setup for each team

One common use case for creating an LBAC policy is to grant access to logs or metrics with a specific label. For example, you can create a label policy that includes all log lines or metrics with the label `namespace`.

We have two teams, Team A and Team B with `Query` permissions. Data source access is set up with `Admin` roles to have `Admin` permission only.

- Team A has a rule `namespace="dev"`.

- Team B has a rule `namespace="prod"`.

A user that is part of Team A will have access to logs or metrics matching `namespace="dev"`. A user in both Team A and Team B will have access to data matching `namespace="dev"` OR `namespace="prod"`.

### Task 2: Set up a rule to exclude a label for a team

One common use case for creating an LBAC policy is to exclude logs or metrics that have a specific label. For example, you can create a label policy that excludes all log lines with the label `secret=true` by adding a selector with `secret!="true"` when you create an access policy:

We have one team, Team A `Query` permissions. Data source access is setup with `Admin` roles to have `Admin` permission only.

- Team A has a rule `secret!="true"`.

A user that is part of Team A will **NOT** have access to logs or metrics that match `secret!="true"`.

### Task 3: Set up multiple rules for a team

We have two teams, Team A and Team B with `Query` permissions. Data Source access is setup with `Admin` roles having `Admin` permission.

- Team A has rule `cluster="us-west-0", namespace=~"dev|prod"` configured.

- Team B has rule `cluster="us-west-0", namespace="staging"` configured.

A user that is only part of Team A will have access to logs that match `cluster="us-west-0" AND (namespace="dev" OR namespace="prod")`.

A user that is only part of Team B will have access to logs that match `cluster="us-west-0" AND namespace="staging"`.

A user in Team A has access to logs in cluster us-west-0 with namespaces `dev` and `prod`. A user in Team B has access to to everything in cluster us-west-0, except namespace prod. So basically, user who is member of both team A and team B has access to everything in cluster us-west-0.

A user that is **not** part of any Team with `Editor/Viewer` role will not have access to query any logs.

**Important**

A `Admin` user that is part of a Team with will only have access to that teams logs

A `Admin` user that is not part of any Team with `Admin` role will have access to all logs

### Task 4: Rules that overlap

We have two teams, Team A and Team B.

- Team A has a rule `namespace="dev"`.

- Team B has a rule `namespace!="dev"`.

A user in Team A will have access to logs that match `namespace="dev"`.

A user in Team B will have access to logs that match `namespace!="dev"`.

> _NOTE:_ A user that is part of Team A and Team B will have access to all logs that match `namespace="dev"` `OR` `namespace!="dev"`.

### Task 5: Single rule setup for a team

We have two teams, Team A and Team B. Data Source access is setup with `Editor`, `Viewer` roles to have `Query` permission.

- Team A has a rule `namespace="dev"` configured.

- Team B does not have a rule configured for it.

A user that is part of Team A will have access to logs that match `namespace="dev"`.

A user that is part of Team A and part of Team B will have access to logs that match `namespace="dev"`.

A user that is not part of Team A and part of Team B, that is `Editor` or `Viewer` will have access to all logs (due to the query permission for the user).

### Task 6: User A is Admin and part of Team B

We have team B, user A is part of Team B and has an `Admin` basic role.

- Team B has no roles assigned
- Team B has Query permissions to data source

- Team B has a rule `{ project_id="project-dev" }`

User A may only access logs or metrics for a data source that match `{ project_id="project-dev" }`.
