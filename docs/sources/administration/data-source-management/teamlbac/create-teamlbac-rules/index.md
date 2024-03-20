---
description: Learn how to create Team LBAC rules for the Loki data source.
keywords:
  - loki
  - lbac
  - team
labels:
  products:
    - enterprise
    - cloud
title: Create Team LBAC rules for the Loki data source
weight: 250
---

# Create Team LBAC rules for the Loki data source

Team LBAC is available on Cloud for data sources created with basic authentication. Any managed Loki data source can **NOT** be configured with Team LBAC rules.

## Before you begin

- Be sure that you have admin data source permissions for Grafana.
- Be sure that you have a team setup in Grafana.

### Create a Team LBAC Rule for a team

1. Navigate to your Loki datasource
1. Navigate to the permissions tab
   - Here, you'll find the Team LBAC rules section.
1. Add a Team LBAC Rule
   - Add a new rule for the team in the Team LBAC rules section.
1. Define Label Selector for the Rule
   - Add a label selector to the rule. Refer to Loki query documentation for guidance on the types of log selections you can specify.

### LBAC rule

A LBAC rule is a `logql` query that runs as a query to the loki instance for your logs. Each rule is it's own filtering operating independently from the other rules within a team. For example, you can create a label policy that includes all log lines with the label.

One rule `{namespace="dev", cluster="us-west-0"}` created with multiple namespaces will be seen as `namespace="dev"` **AND** `cluster="us-west-0"`.
Two rules `{namespace="dev"}`, `{cluster="us-west-0"}` created for a team will be seen as `namespace="dev"` **OR** `cluster="us-west-0"`.

#### Best practices

We recommend you only add `query` permissions for teams that should use the data source and only `Admin` have `Admin` permissions.

We recommend for a first setup, setting up as few rules as possible for each team and make them additive for simplicity.

For validating the rules, we recommend testing the rules in the Loki Explore view. This will allow you to see the logs that would be returned for the rule.

#### Tasks

### Task 1: One rule setup for each team

One common use case for creating an LBAC policy is to have specific access to logs that have a specific label. For example, you can create a label policy that includes all log lines with the label.

We have two teams, Team A and Team B with `Query` permissions. Loki access is setup with `Admin` roles to have `Admin` permission only.

- Team A has a rule `namespace="dev"`.

- Team B has a rule `namespace="prod"`.

A user that is part of Team A will have access to logs that match `namespace="dev"`.

A user that is part of Team B will have access to logs that match `namespace="prod"`.

A user that is part of Team A and Team B will have access to logs that match `namespace="dev"` OR `namespace="prod"`.

### Task 2: One rule setup for a team Exclude a label

One common use case for creating an LBAC policy is to exclude logs that have a specific label. For example, you can create a label policy that excludes all log lines with the label secret=true by adding a selector with `secret!="true"` when you create an access policy:

We have one team, Team A `Query` permissions. Loki access is setup with `Admin` roles to have `Admin` permission only.

- Team A has a rule `secret!="true"`.

A user that is part of Team A will **NOT** have access to logs that match `secret!="true"`.

### Task 3: Multiple rules setup for one team

We have two teams, Team A and Team B with `Query` permissions. Loki access is setup with `Admin` roles having `Admin` permission.

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

### Task 5: One rule setup for a Team

We have two teams, Team A and Team B. Loki access is setup with `Editor`, `Viewer` roles to have `Query` permission.

- Team A has a rule `namespace="dev"` configured.

- Team B does not have a rule configured for it.

A user that is part of Team A will have access to logs that match `namespace="dev"`.

A user that is part of Team A and part of Team B will have access to logs that match `namespace="dev"`.

A user that is not part of Team A and part of Team B, that is `Editor` or `Viewer` will have access to all logs (due to the query permission for the user).
