---
aliases:
  - ../../../enterprise/activate-aws-marketplace-license/activate-license-on-ecs/
  - ../../../enterprise/license/activate-aws-marketplace-license/activate-license-on-ecs/
description: Configure Team LBAC rules for Loki data source
keywords:
  - grafana
  - ecs
  - enterprise
  - aws
  - marketplace
  - activate
labels:
  products:
    - enterprise
    - oss
title: Configure Team LBAC rules for a Loki data source
weight: 250
---

# Configure Team LBAC for Loki data source on Grafana Cloud

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

#### Best practices

We recommend you only add team LBAC permissions for teams that should use the data source and remove default `Viewer` and `Editor` query permissions.

We recommend for a first setup, setting up as few rules for each team as possible and make them additive and not negated.

For validating the rules, we recommend testing the rules in the Loki Explore view. This will allow you to see the logs that would be returned for the rule.

#### Tasks

### Task 1: One rule setup for each team

We have two teams, Team A and Team B. Loki access is setup with `Admin` roles to have `Admin` permission only.

- Team A has a rule `namespace="dev"`.

- Team B has a rule `namespace="prod"`.

A user that is part of Team A will have access to logs that match `namespace="dev"`.

A user that is part of Team B will have access to logs that match `namespace="prod"`.

### Task 2: Multiple rules setup for one team

We have two teams, Team A and Team B. Loki access is setup with `Admin` roles having `Admin` permission.

- Team A has rule `cluster="us-west-0", namespace=~"dev|prod"` configured.

- Team B has rule `cluster="us-west-0", namespace="!prod"` configured.

A user that is only part of Team A will have access to logs that match `cluster="us-west-0" AND (namespace="dev" OR namespace="prod")`.

A user that is only part of Team B will have access to logs that match `cluster="us-west-0" AND namespace!="prod"`.

A user that is part of both Team A and Team B will have access to logs that match `cluster="us-west-0" AND (namespace="dev" OR namespace="prod") OR (is this true?) (cluster="us-west-0" AND namespace!="prod")`.

A user that is **not** part of any Team with `Editor/Viewer` role will not have access to query any logs.

**Important**

A `Admin` user that is part of a Team with will only have access to that teams logs

A `Admin` user that is not part of any Team with `Admin` role will have access to all logs

### Task 3: Rules that overlap

We have two teams, Team A and Team B.

- Team A has a rule `namespace="dev"`.

- Team B has a rule `namespace!="dev"`.

A user in Team A will have access to logs that match `namespace="dev"`.

A user in Team b will have access to logs that match `namespace!="dev"`.

> _NOTE:_ A user that is part of Team A and Team B will have access to all logs that match `namespace="dev"` `OR` `namespace!="dev"`.

### Task 4: One rule setup for a Team

We have two teams, Team A and Team B. Loki access is setup with `Editor`, `Viewer` roles to have `Query` permission.

- Team A has a rule `namespace="dev"` configured.

- Team B does not have a rule configured for it.

A user that is part of Team A will have access to logs that match `namespace="dev"`.

A user that is part of Team A and part of Team B will have access to logs that match `namespace="dev"`.

A user that is not part of Team A and part of Team B, that is `Editor` or `Viewer` will have access to all logs (due to the query permission for the user).
